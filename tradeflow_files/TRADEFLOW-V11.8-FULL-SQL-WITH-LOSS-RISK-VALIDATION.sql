-- ============================================================
-- TradeFlow v11.7 — FULL DATABASE SQL
-- Includes: base schema, secure 6-digit PIN RPC access,
-- Break Even + Trading Setup, multi-account risk,
-- Growth Cycle / Trade Return %, explicit Reset Cycle fix,
-- and Goals.
--
-- IMPORTANT: Replace YOUR_6_DIGIT_CODE below with your own
-- v11.8 rule: on Loss, abs(Trade Return %) > selected Risk % => Risk Management Broke Rules.
-- The real return still saves; existing data is preserved and recomputed.
-- exact 6-digit code BEFORE running.
-- This script is designed to preserve existing rows.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 1) BASE TABLES
-- ------------------------------------------------------------

create table if not exists public.user_settings (
  id smallint primary key default 1 check (id = 1),
  official_start_date date not null default date '2026-10-22',
  theme text not null default 'dark' check (theme in ('dark','light')),
  failed_attempts integer not null default 0,
  lock_until timestamptz null
);

insert into public.user_settings(id, official_start_date, theme)
values (1, date '2026-10-22', 'dark')
on conflict (id) do update
set official_start_date = date '2026-10-22';

create table if not exists public.daily_reviews (
  date date primary key,
  risk text null,
  strategy text null,
  result text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Initial official TradeFlow day. Does not overwrite Setup/account fields.
insert into public.daily_reviews(date, risk, strategy, result)
values (date '2026-10-22', 'followed', 'followed', 'loss')
on conflict (date) do nothing;

alter table public.daily_reviews enable row level security;
alter table public.user_settings enable row level security;

-- TradeFlow secure public-repo setup
-- Run this AFTER the base daily_reviews + user_settings tables exist.
-- Replace YOUR_6_DIGIT_CODE before running.

create extension if not exists pgcrypto with schema extensions;

-- Private access-code storage (hash only)
create table if not exists public.app_access (
  id smallint primary key default 1 check (id = 1),
  access_code_hash text not null
);

-- Private temporary session storage
create table if not exists public.tradeflow_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Never allow browser roles to read/write the underlying tables directly.
revoke all on table public.daily_reviews from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;
revoke all on table public.app_access from anon, authenticated;
revoke all on table public.tradeflow_sessions from anon, authenticated;

-- Remove the permissive policies from the earlier simple-direct version.
drop policy if exists "tradeflow_reviews_access" on public.daily_reviews;
drop policy if exists "tradeflow_settings_read" on public.user_settings;
drop policy if exists "tradeflow_settings_update" on public.user_settings;

-- Trading Setup migration: nullable so existing reviews remain valid.
alter table public.daily_reviews add column if not exists setup text null;
alter table public.daily_reviews drop constraint if exists daily_reviews_setup_check;
alter table public.daily_reviews
  add constraint daily_reviews_setup_check
  check (setup in ('setup_1','setup_2','setup_3','setup_4') or setup is null);

-- Result migration: add Break Even without changing existing rows.
alter table public.daily_reviews drop constraint if exists daily_reviews_result_check;
alter table public.daily_reviews drop constraint if exists daily_review_logic;

alter table public.daily_reviews
  add constraint daily_reviews_result_check
  check (result in ('win','loss','break_even','no_trade') or result is null);

alter table public.daily_reviews
  add constraint daily_review_logic
  check (
    (result = 'no_trade' and risk is null and strategy is null and setup is null)
    or
    (result in ('win','loss','break_even') and risk is not null and strategy is not null and (setup is null or setup in ('setup_1','setup_2','setup_3','setup_4')))
    or
    (result is null and risk is not null and strategy is not null and (setup is null or setup in ('setup_1','setup_2','setup_3','setup_4')))
  );

-- Store/change your code as a bcrypt hash. The raw code is not stored.
insert into public.app_access (id, access_code_hash)
values (1, extensions.crypt('YOUR_6_DIGIT_CODE', extensions.gen_salt('bf')))
on conflict (id) do update
set access_code_hash = excluded.access_code_hash;

-- Helper: validate a temporary session token.
create or replace function public.tradeflow_session_valid(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if p_token is null or length(p_token) < 32 then
    return false;
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  return exists (
    select 1
    from public.tradeflow_sessions
    where token_hash = v_hash
      and expires_at > now()
  );
end;
$$;

revoke all on function public.tradeflow_session_valid(text) from public, anon, authenticated;

-- Unlock: verify code, rate-limit failures, and return a temporary token.
create or replace function public.tradeflow_unlock(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_attempts integer := 0;
  v_lock_until timestamptz;
  v_token text;
  v_token_hash text;
  v_expires timestamptz;
begin
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'message', 'Enter a valid 6-digit code.');
  end if;

  select failed_attempts, lock_until
    into v_attempts, v_lock_until
  from public.user_settings
  where id = 1;

  if v_lock_until is not null and v_lock_until > now() then
    return jsonb_build_object('ok', false, 'message', 'Too many attempts. Try again later.');
  end if;

  select access_code_hash into v_hash
  from public.app_access
  where id = 1;

  if v_hash is null or extensions.crypt(p_code, v_hash) <> v_hash then
    v_attempts := coalesce(v_attempts, 0) + 1;

    if v_attempts >= 5 then
      update public.user_settings
      set failed_attempts = 0,
          lock_until = now() + interval '15 minutes'
      where id = 1;
      return jsonb_build_object('ok', false, 'message', 'Too many attempts. Try again later.');
    end if;

    update public.user_settings
    set failed_attempts = v_attempts,
        lock_until = null
    where id = 1;

    return jsonb_build_object('ok', false, 'message', 'Incorrect code.');
  end if;

  update public.user_settings
  set failed_attempts = 0,
      lock_until = null
  where id = 1;

  -- Clean expired sessions, then issue a fresh 12-hour token.
  delete from public.tradeflow_sessions where expires_at <= now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires := now() + interval '12 hours';

  insert into public.tradeflow_sessions(token_hash, expires_at)
  values (v_token_hash, v_expires);

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'expiresAt', v_expires
  );
end;
$$;

-- Bootstrap all app data after token validation.
create or replace function public.tradeflow_bootstrap(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reviews jsonb;
  v_settings jsonb;
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.date desc), '[]'::jsonb)
    into v_reviews
  from public.daily_reviews r;

  select to_jsonb(s)
    into v_settings
  from public.user_settings s
  where id = 1;

  return jsonb_build_object('reviews', v_reviews, 'settings', v_settings);
end;
$$;

create or replace function public.tradeflow_set_theme(p_token text, p_theme text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_row public.user_settings%rowtype;
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;
  if p_theme not in ('dark','light') then raise exception 'Invalid theme'; end if;

  update public.user_settings set theme = p_theme where id = 1 returning * into v_row;
  return jsonb_build_object('settings', to_jsonb(v_row));
end;
$$;

drop function if exists public.tradeflow_upsert_review(text,date,text,text,text);

create or replace function public.tradeflow_upsert_review(
  p_token text,
  p_date date,
  p_risk text,
  p_strategy text,
  p_setup text,
  p_result text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_row public.daily_reviews%rowtype;
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;

  if p_result not in ('win','loss','break_even','no_trade') then raise exception 'Invalid result'; end if;
  if p_result = 'no_trade' then
    p_risk := null; p_strategy := null; p_setup := null;
  else
    if p_risk not in ('followed','broke') or p_strategy not in ('followed','broke') then
      raise exception 'Risk and strategy are required';
    end if;
    if p_setup not in ('setup_1','setup_2','setup_3','setup_4') then
      raise exception 'Trading setup is required';
    end if;
  end if;

  insert into public.daily_reviews(date,risk,strategy,setup,result)
  values (p_date,p_risk,p_strategy,p_setup,p_result)
  on conflict (date) do update set
    risk = excluded.risk,
    strategy = excluded.strategy,
    setup = excluded.setup,
    result = excluded.result,
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object('review', to_jsonb(v_row));
end;
$$;

create or replace function public.tradeflow_delete_review(p_token text, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;
  delete from public.daily_reviews where date = p_date;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.tradeflow_import(
  p_token text,
  p_reviews jsonb,
  p_theme text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r record;
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;

  if p_reviews is not null and jsonb_typeof(p_reviews) = 'array' then
    for r in
      select * from jsonb_to_recordset(p_reviews)
      as x(date date, risk text, strategy text, setup text, result text)
    loop
      if r.result = 'no_trade' then
        r.risk := null; r.strategy := null; r.setup := null;
      end if;
      if r.result in ('win','loss','break_even','no_trade')
         and (r.result = 'no_trade' or (r.risk in ('followed','broke') and r.strategy in ('followed','broke') and (r.setup is null or r.setup in ('setup_1','setup_2','setup_3','setup_4')))) then
        insert into public.daily_reviews(date,risk,strategy,setup,result)
        values(r.date,r.risk,r.strategy,r.setup,r.result)
        on conflict(date) do update set
          risk=excluded.risk,
          strategy=excluded.strategy,
          setup=excluded.setup,
          result=excluded.result,
          updated_at=now();
      end if;
    end loop;
  end if;

  if p_theme in ('dark','light') then
    update public.user_settings set theme = p_theme where id = 1;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Public browser role can call ONLY these controlled RPC entry points.
revoke all on function public.tradeflow_unlock(text) from public;
revoke all on function public.tradeflow_bootstrap(text) from public;
revoke all on function public.tradeflow_set_theme(text,text) from public;
revoke all on function public.tradeflow_upsert_review(text,date,text,text,text,text) from public;
revoke all on function public.tradeflow_delete_review(text,date) from public;
revoke all on function public.tradeflow_import(text,jsonb,text) from public;

grant execute on function public.tradeflow_unlock(text) to anon;
grant execute on function public.tradeflow_bootstrap(text) to anon;
grant execute on function public.tradeflow_set_theme(text,text) to anon;
grant execute on function public.tradeflow_upsert_review(text,date,text,text,text,text) to anon;
grant execute on function public.tradeflow_delete_review(text,date) to anon;
grant execute on function public.tradeflow_import(text,jsonb,text) to anon;

notify pgrst, 'reload schema';


-- ============================================================
-- MULTI-ACCOUNT LAYER
-- ============================================================
-- TradeFlow v10: Multi-Account 5% Risk Cycle Discipline
-- Run once in Supabase SQL Editor after your existing TradeFlow setup.
-- Preserves existing reviews/access code. Old reviews remain legacy/unmanaged until saved with account data.

create extension if not exists pgcrypto with schema extensions;

alter table public.daily_reviews add column if not exists account_managed boolean not null default false;

create table if not exists public.tradeflow_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tradeflow_accounts_active_name_uq
on public.tradeflow_accounts (lower(name)) where active = true;

create table if not exists public.daily_review_account_risks (
  review_date date not null references public.daily_reviews(date) on delete cascade,
  account_id uuid not null references public.tradeflow_accounts(id),
  risk_pct smallint not null check (risk_pct in (1,2)),
  violated boolean not null default false,
  cycle_used_before smallint not null default 0,
  two_used_before boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (review_date, account_id)
);

-- Seed the two initial accounts only when no accounts exist yet.
insert into public.tradeflow_accounts(name)
select 'Master Account' where not exists (select 1 from public.tradeflow_accounts);
insert into public.tradeflow_accounts(name)
select 'Evaluation Account' where (select count(*) from public.tradeflow_accounts)=1
  and not exists (select 1 from public.tradeflow_accounts where lower(name)=lower('Evaluation Account'));

alter table public.tradeflow_accounts enable row level security;
alter table public.daily_review_account_risks enable row level security;
revoke all on table public.tradeflow_accounts from anon, authenticated;
revoke all on table public.daily_review_account_risks from anon, authenticated;

create or replace function public.tradeflow_recompute_risk_discipline()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a record;
  r record;
  v_used integer;
  v_two boolean;
  v_violation boolean;
begin
  -- Recompute each account independently, chronologically.
  for a in select id from public.tradeflow_accounts loop
    v_used := 0;
    v_two := false;
    for r in
      select review_date, account_id, risk_pct
      from public.daily_review_account_risks
      where account_id = a.id
      order by review_date
    loop
      v_violation := (r.risk_pct = 2 and v_two);
      update public.daily_review_account_risks
      set violated = v_violation,
          cycle_used_before = v_used,
          two_used_before = v_two
      where review_date = r.review_date and account_id = r.account_id;

      if r.risk_pct = 2 then v_two := true; end if;
      v_used := v_used + r.risk_pct;
      while v_used >= 5 loop
        v_used := v_used - 5;
        v_two := false;
      end loop;
    end loop;
  end loop;

  -- Managed real-trade days are Followed unless at least one selected account violated.
  update public.daily_reviews d
  set risk = case when exists (
      select 1 from public.daily_review_account_risks ar
      where ar.review_date = d.date and ar.violated
    ) then 'broke' else 'followed' end,
      updated_at = now()
  where d.account_managed = true and d.result in ('win','loss','break_even');

  update public.daily_reviews d
  set risk = null, account_managed = false, updated_at = now()
  where d.result = 'no_trade' and d.account_managed = true;
end;
$$;

create or replace function public.tradeflow_upsert_review_v2(
  p_token text,
  p_date date,
  p_strategy text,
  p_setup text,
  p_result text,
  p_account_risks jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  x record;
  v_count integer := 0;
begin
  if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
  if p_result not in ('win','loss','break_even','no_trade') then raise exception 'Invalid result'; end if;

  if p_result = 'no_trade' then
    p_strategy := null; p_setup := null; p_account_risks := '[]'::jsonb;
  else
    if p_strategy not in ('followed','broke') then raise exception 'Strategy is required'; end if;
    if p_setup not in ('setup_1','setup_2','setup_3','setup_4') then raise exception 'Trading setup is required'; end if;
    if jsonb_typeof(p_account_risks) <> 'array' or jsonb_array_length(p_account_risks)=0 then raise exception 'Select at least one account and risk percentage'; end if;
  end if;

  insert into public.daily_reviews(date,risk,strategy,setup,result,account_managed)
  values(p_date,case when p_result='no_trade' then null else 'followed' end,p_strategy,p_setup,p_result,p_result<>'no_trade')
  on conflict(date) do update set strategy=excluded.strategy,setup=excluded.setup,result=excluded.result,
    risk=excluded.risk,account_managed=excluded.account_managed,updated_at=now();

  delete from public.daily_review_account_risks where review_date=p_date;

  if p_result <> 'no_trade' then
    for x in select * from jsonb_to_recordset(p_account_risks) as z(account_id uuid,risk_pct integer) loop
      if x.risk_pct not in (1,2) then raise exception 'Risk must be 1%% or 2%%'; end if;
      if not exists(select 1 from public.tradeflow_accounts where id=x.account_id and active=true) then raise exception 'Invalid or archived account'; end if;
      insert into public.daily_review_account_risks(review_date,account_id,risk_pct) values(p_date,x.account_id,x.risk_pct);
      v_count := v_count + 1;
    end loop;
    if v_count=0 then raise exception 'Select at least one account'; end if;
  end if;

  perform public.tradeflow_recompute_risk_discipline();
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.tradeflow_add_account(p_token text,p_name text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v public.tradeflow_accounts%rowtype;
begin
 if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
 if length(trim(coalesce(p_name,'')))<1 then raise exception 'Account name is required'; end if;
 insert into public.tradeflow_accounts(name) values(left(trim(p_name),60)) returning * into v;
 return to_jsonb(v);
end;$$;

create or replace function public.tradeflow_rename_account(p_token text,p_account_id uuid,p_name text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v public.tradeflow_accounts%rowtype;
begin
 if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
 if length(trim(coalesce(p_name,'')))<1 then raise exception 'Account name is required'; end if;
 update public.tradeflow_accounts set name=left(trim(p_name),60),updated_at=now() where id=p_account_id returning * into v;
 if v.id is null then raise exception 'Account not found'; end if;
 return to_jsonb(v);
end;$$;

create or replace function public.tradeflow_archive_account(p_token text,p_account_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
begin
 if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
 update public.tradeflow_accounts set active=false,updated_at=now() where id=p_account_id;
 if not found then raise exception 'Account not found'; end if;
 return jsonb_build_object('ok',true);
end;$$;

-- Replace bootstrap so the app receives accounts + account risk history.
create or replace function public.tradeflow_bootstrap(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_reviews jsonb;v_settings jsonb;v_accounts jsonb;v_risks jsonb;
begin
 if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.date desc),'[]'::jsonb) into v_reviews from public.daily_reviews r;
 select to_jsonb(s) into v_settings from public.user_settings s where id=1;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at),'[]'::jsonb) into v_accounts from public.tradeflow_accounts a;
 select coalesce(jsonb_agg(to_jsonb(ar) order by ar.review_date,ar.account_id),'[]'::jsonb) into v_risks from public.daily_review_account_risks ar;
 return jsonb_build_object('reviews',v_reviews,'settings',v_settings,'accounts',v_accounts,'account_risks',v_risks);
end;$$;

-- Replace delete so cycle/risk discipline is recalculated after historical deletion.
create or replace function public.tradeflow_delete_review(p_token text,p_date date)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
begin
 if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
 delete from public.daily_reviews where date=p_date;
 perform public.tradeflow_recompute_risk_discipline();
 return jsonb_build_object('ok',true);
end;$$;

revoke all on function public.tradeflow_upsert_review_v2(text,date,text,text,text,jsonb) from public;
revoke all on function public.tradeflow_add_account(text,text) from public;
revoke all on function public.tradeflow_rename_account(text,uuid,text) from public;
revoke all on function public.tradeflow_archive_account(text,uuid) from public;
grant execute on function public.tradeflow_upsert_review_v2(text,date,text,text,text,jsonb) to anon;
grant execute on function public.tradeflow_add_account(text,text) to anon;
grant execute on function public.tradeflow_rename_account(text,uuid,text) to anon;
grant execute on function public.tradeflow_archive_account(text,uuid) to anon;
-- bootstrap/delete execute grants usually already exist; re-grant safely.
grant execute on function public.tradeflow_bootstrap(text) to anon;
grant execute on function public.tradeflow_delete_review(text,date) to anon;

notify pgrst, 'reload schema';

-- Backup import with backward compatibility. Empty account arrays are valid for older backups.
create or replace function public.tradeflow_import_v2(
  p_token text,
  p_reviews jsonb,
  p_accounts jsonb default '[]'::jsonb,
  p_account_risks jsonb default '[]'::jsonb,
  p_theme text default null
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare a record;r record;x record;
begin
 if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
 if p_accounts is not null and jsonb_typeof(p_accounts)='array' then
  for a in select * from jsonb_to_recordset(p_accounts) as z(id uuid,name text,active boolean) loop
    if a.id is not null and length(trim(coalesce(a.name,'')))>0 then
      insert into public.tradeflow_accounts(id,name,active) values(a.id,left(trim(a.name),60),coalesce(a.active,true))
      on conflict(id) do update set name=excluded.name,active=excluded.active,updated_at=now();
    end if;
  end loop;
 end if;
 if p_reviews is not null and jsonb_typeof(p_reviews)='array' then
  for r in select * from jsonb_to_recordset(p_reviews) as z(date date,risk text,strategy text,setup text,result text) loop
    if r.result='no_trade' then r.risk:=null;r.strategy:=null;r.setup:=null; end if;
    if r.result in ('win','loss','break_even','no_trade') then
      insert into public.daily_reviews(date,risk,strategy,setup,result,account_managed)
      values(r.date,r.risk,r.strategy,r.setup,r.result,false)
      on conflict(date) do update set risk=excluded.risk,strategy=excluded.strategy,setup=excluded.setup,result=excluded.result,updated_at=now();
    end if;
  end loop;
 end if;
 if p_account_risks is not null and jsonb_typeof(p_account_risks)='array' then
  for x in select * from jsonb_to_recordset(p_account_risks) as z(review_date date,account_id uuid,risk_pct integer) loop
    if x.risk_pct in (1,2) and exists(select 1 from public.daily_reviews where date=x.review_date and result in ('win','loss','break_even')) and exists(select 1 from public.tradeflow_accounts where id=x.account_id) then
      insert into public.daily_review_account_risks(review_date,account_id,risk_pct) values(x.review_date,x.account_id,x.risk_pct)
      on conflict(review_date,account_id) do update set risk_pct=excluded.risk_pct;
      update public.daily_reviews set account_managed=true where date=x.review_date;
    end if;
  end loop;
 end if;
 if p_theme in ('dark','light') then update public.user_settings set theme=p_theme where id=1; end if;
 perform public.tradeflow_recompute_risk_discipline();
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.tradeflow_import_v2(text,jsonb,jsonb,jsonb,text) from public;
grant execute on function public.tradeflow_import_v2(text,jsonb,jsonb,jsonb,text) to anon;
notify pgrst, 'reload schema';


-- ============================================================
-- GROWTH CYCLE / TRADE RETURN LAYER
-- ============================================================
-- TradeFlow v11 — Growth Cycle + 2% Buffer update
-- Run after the existing TradeFlow secure RPC setup / v10 update.
-- Preserves the current access code and existing historical reviews.

create extension if not exists pgcrypto with schema extensions;

alter table public.tradeflow_accounts
  add column if not exists account_size numeric(14,2) null;

alter table public.daily_review_account_risks
  add column if not exists trade_return_pct numeric(9,3) null;

-- Remove v10 derived cycle-counter fields; v11 derives cycle state from source history.
alter table public.daily_review_account_risks drop column if exists cycle_used_before;
alter table public.daily_review_account_risks drop column if exists two_used_before;

create table if not exists public.tradeflow_account_resets (
  id bigint generated by default as identity primary key,
  account_id uuid not null references public.tradeflow_accounts(id) on delete cascade,
  reset_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists tradeflow_account_resets_account_date_idx
  on public.tradeflow_account_resets(account_id, reset_date, created_at);

alter table public.tradeflow_account_resets enable row level security;
revoke all on table public.tradeflow_account_resets from anon, authenticated;

create or replace function public.tradeflow_cycle_number(p_total_return numeric)
returns integer
language sql
immutable
as $$
  select greatest(1, floor(coalesce(p_total_return,0) / 5.0)::integer + 3)
$$;

create or replace function public.tradeflow_cycle_base_pct(p_cycle integer)
returns numeric
language sql
immutable
as $$
  select (greatest(1,p_cycle) - 3) * 5.0
$$;

-- Recalculate only v11 rows (trade_return_pct IS NOT NULL).
-- Legacy v10 rows remain historical and are not rewritten by the new buffer rule.
create or replace function public.tradeflow_recompute_growth_risk()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a record;
  r record;
  v_reset_date date;
  v_total numeric := 0;
  v_cycle integer := 3;
  v_before_cycle integer;
  v_after_cycle integer;
  v_two_used boolean := false;
  v_base_pct numeric;
  v_progress numeric;
  v_violation boolean;
begin
  -- Start clean for managed v11 rows only.
  update public.daily_review_account_risks
  set violated = false
  where trade_return_pct is not null;

  for a in
    select id, account_size
    from public.tradeflow_accounts
    where account_size is not null and account_size > 0
  loop
    v_reset_date := null;
    v_total := 0;
    v_cycle := 3;
    v_two_used := false;

    for r in
      select ar.review_date, ar.account_id, ar.risk_pct, ar.trade_return_pct,
             (select max(rr.reset_date)
                from public.tradeflow_account_resets rr
               where rr.account_id = a.id
                 and rr.reset_date <= ar.review_date) as effective_reset_date
      from public.daily_review_account_risks ar
      where ar.account_id = a.id
        and ar.trade_return_pct is not null
      order by ar.review_date, ar.created_at
    loop
      if v_reset_date is distinct from r.effective_reset_date then
        v_reset_date := r.effective_reset_date;
        v_total := 0;
        v_cycle := 3;
        v_two_used := false;
      end if;

      v_before_cycle := public.tradeflow_cycle_number(v_total);
      if v_before_cycle <> v_cycle then
        v_cycle := v_before_cycle;
        v_two_used := false;
      end if;

      v_base_pct := public.tradeflow_cycle_base_pct(v_before_cycle);
      v_progress := v_total - v_base_pct;
      v_violation := false;

      if r.risk_pct = 2 then
        if v_progress < 2 then v_violation := true; end if;
        if v_two_used then v_violation := true; end if;
      end if;

      update public.daily_review_account_risks
      set violated = v_violation
      where review_date = r.review_date and account_id = r.account_id;

      if r.risk_pct = 2 then v_two_used := true; end if;

      v_total := v_total + coalesce(r.trade_return_pct,0);
      v_after_cycle := public.tradeflow_cycle_number(v_total);

      if v_after_cycle <> v_before_cycle then
        v_cycle := v_after_cycle;
        v_two_used := false;
      else
        v_cycle := v_before_cycle;
      end if;
    end loop;
  end loop;

  -- Only v11 managed days are recalculated. Legacy rows with NULL return remain unchanged.
  update public.daily_reviews d
  set risk = case when exists (
      select 1 from public.daily_review_account_risks ar
      where ar.review_date = d.date
        and ar.trade_return_pct is not null
        and ar.violated
    ) then 'broke' else 'followed' end,
      updated_at = now()
  where d.account_managed = true
    and d.result in ('win','loss','break_even')
    and exists (
      select 1 from public.daily_review_account_risks ar
      where ar.review_date = d.date and ar.trade_return_pct is not null
    );
end;
$$;

create or replace function public.tradeflow_add_account_v3(
  p_token text,
  p_name text,
  p_account_size numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v public.tradeflow_accounts%rowtype;
begin
  if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
  if length(trim(coalesce(p_name,''))) < 1 then raise exception 'Account name is required'; end if;
  if p_account_size is null or p_account_size <= 0 then raise exception 'Valid Account Size is required'; end if;

  insert into public.tradeflow_accounts(name,account_size)
  values(left(trim(p_name),60),round(p_account_size,2))
  returning * into v;

  insert into public.tradeflow_account_resets(account_id,reset_date)
  values(v.id,current_date);

  return to_jsonb(v);
end;
$$;

create or replace function public.tradeflow_update_account_v3(
  p_token text,
  p_account_id uuid,
  p_name text,
  p_account_size numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v public.tradeflow_accounts%rowtype;
  v_old_size numeric;
begin
  if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
  if length(trim(coalesce(p_name,''))) < 1 then raise exception 'Account name is required'; end if;
  if p_account_size is null or p_account_size <= 0 then raise exception 'Valid Account Size is required'; end if;

  select account_size into v_old_size from public.tradeflow_accounts where id=p_account_id;
  if not found then raise exception 'Account not found'; end if;

  update public.tradeflow_accounts
  set name=left(trim(p_name),60), account_size=round(p_account_size,2), updated_at=now()
  where id=p_account_id
  returning * into v;

  -- IMPORTANT: setting or editing Account Size must NOT create a reset.
  -- Existing Trade Return % history remains part of the active cycle.
  -- Only the explicit Reset Cycle action creates a reset marker.

  perform public.tradeflow_recompute_growth_risk();
  return to_jsonb(v);
end;
$$;

create or replace function public.tradeflow_reset_account_v3(
  p_token text,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
  if not exists(select 1 from public.tradeflow_accounts where id=p_account_id and account_size is not null and account_size>0) then
    raise exception 'Set Account Size before resetting the cycle';
  end if;

  insert into public.tradeflow_account_resets(account_id,reset_date)
  values(p_account_id,current_date);

  perform public.tradeflow_recompute_growth_risk();
  return jsonb_build_object('ok',true,'reset_date',current_date);
end;
$$;

create or replace function public.tradeflow_upsert_review_v2(
  p_token text,
  p_date date,
  p_strategy text,
  p_setup text,
  p_result text,
  p_account_risks jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  x record;
  v_count integer := 0;
begin
  if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
  if p_result not in ('win','loss','break_even','no_trade') then raise exception 'Invalid result'; end if;

  if p_result='no_trade' then
    p_strategy:=null; p_setup:=null; p_account_risks:='[]'::jsonb;
  else
    if p_strategy not in ('followed','broke') then raise exception 'Strategy is required'; end if;
    if p_setup not in ('setup_1','setup_2','setup_3','setup_4') then raise exception 'Trading setup is required'; end if;
    if jsonb_typeof(p_account_risks)<>'array' or jsonb_array_length(p_account_risks)=0 then raise exception 'Select at least one account'; end if;
  end if;

  insert into public.daily_reviews(date,risk,strategy,setup,result,account_managed)
  values(p_date,case when p_result='no_trade' then null else 'followed' end,p_strategy,p_setup,p_result,p_result<>'no_trade')
  on conflict(date) do update set strategy=excluded.strategy,setup=excluded.setup,result=excluded.result,
    risk=excluded.risk,account_managed=excluded.account_managed,updated_at=now();

  delete from public.daily_review_account_risks where review_date=p_date;

  if p_result<>'no_trade' then
    for x in
      select * from jsonb_to_recordset(p_account_risks)
      as z(account_id uuid,risk_pct integer,trade_return_pct numeric)
    loop
      if x.risk_pct not in (1,2) then raise exception 'Risk must be 1%% or 2%%'; end if;
      if not exists(select 1 from public.tradeflow_accounts where id=x.account_id and active=true and account_size is not null and account_size>0) then
        raise exception 'Invalid account or Account Size not set';
      end if;
      if x.trade_return_pct is null then raise exception 'Trade Return %% is required'; end if;
      if p_result='win' and x.trade_return_pct<=0 then raise exception 'Win requires positive Trade Return %%'; end if;
      if p_result='loss' and x.trade_return_pct>=0 then raise exception 'Loss requires negative Trade Return %%'; end if;
      if p_result='break_even' and x.trade_return_pct<>0 then raise exception 'Break Even Trade Return %% must be 0'; end if;

      insert into public.daily_review_account_risks(review_date,account_id,risk_pct,trade_return_pct)
      values(p_date,x.account_id,x.risk_pct,x.trade_return_pct);
      v_count:=v_count+1;
    end loop;
    if v_count=0 then raise exception 'Select at least one account'; end if;
  end if;

  perform public.tradeflow_recompute_growth_risk();
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.tradeflow_bootstrap(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_reviews jsonb;v_settings jsonb;v_accounts jsonb;v_risks jsonb;v_resets jsonb;
begin
  if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.date desc),'[]'::jsonb) into v_reviews from public.daily_reviews r;
  select to_jsonb(s) into v_settings from public.user_settings s where id=1;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at),'[]'::jsonb) into v_accounts from public.tradeflow_accounts a;
  select coalesce(jsonb_agg(to_jsonb(ar) order by ar.review_date,ar.account_id),'[]'::jsonb) into v_risks from public.daily_review_account_risks ar;
  select coalesce(jsonb_agg(to_jsonb(rr) order by rr.reset_date,rr.created_at),'[]'::jsonb) into v_resets from public.tradeflow_account_resets rr;
  return jsonb_build_object('reviews',v_reviews,'settings',v_settings,'accounts',v_accounts,'account_risks',v_risks,'account_resets',v_resets);
end;
$$;

create or replace function public.tradeflow_delete_review(p_token text,p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;
  delete from public.daily_reviews where date=p_date;
  perform public.tradeflow_recompute_growth_risk();
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.tradeflow_import_v3(
  p_token text,
  p_reviews jsonb,
  p_accounts jsonb default '[]'::jsonb,
  p_account_risks jsonb default '[]'::jsonb,
  p_account_resets jsonb default '[]'::jsonb,
  p_theme text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare a record;r record;x record;rr record;
begin
  if not public.tradeflow_session_valid(p_token) then raise exception 'Invalid or expired session'; end if;

  if p_accounts is not null and jsonb_typeof(p_accounts)='array' then
    for a in select * from jsonb_to_recordset(p_accounts) as z(id uuid,name text,account_size numeric,active boolean) loop
      if a.id is not null and length(trim(coalesce(a.name,'')))>0 then
        insert into public.tradeflow_accounts(id,name,account_size,active)
        values(a.id,left(trim(a.name),60),case when a.account_size>0 then a.account_size else null end,coalesce(a.active,true))
        on conflict(id) do update set name=excluded.name,account_size=coalesce(excluded.account_size,public.tradeflow_accounts.account_size),active=excluded.active,updated_at=now();
      end if;
    end loop;
  end if;

  if p_reviews is not null and jsonb_typeof(p_reviews)='array' then
    for r in select * from jsonb_to_recordset(p_reviews) as z(date date,risk text,strategy text,setup text,result text) loop
      if r.result='no_trade' then r.risk:=null;r.strategy:=null;r.setup:=null; end if;
      if r.result in ('win','loss','break_even','no_trade') then
        insert into public.daily_reviews(date,risk,strategy,setup,result,account_managed)
        values(r.date,r.risk,r.strategy,r.setup,r.result,false)
        on conflict(date) do update set risk=excluded.risk,strategy=excluded.strategy,setup=excluded.setup,result=excluded.result,updated_at=now();
      end if;
    end loop;
  end if;

  if p_account_resets is not null and jsonb_typeof(p_account_resets)='array' then
    for rr in select * from jsonb_to_recordset(p_account_resets) as z(account_id uuid,reset_date date) loop
      if rr.account_id is not null and rr.reset_date is not null and exists(select 1 from public.tradeflow_accounts where id=rr.account_id) then
        if not exists(select 1 from public.tradeflow_account_resets where account_id=rr.account_id and reset_date=rr.reset_date) then
          insert into public.tradeflow_account_resets(account_id,reset_date) values(rr.account_id,rr.reset_date);
        end if;
      end if;
    end loop;
  end if;

  if p_account_risks is not null and jsonb_typeof(p_account_risks)='array' then
    for x in select * from jsonb_to_recordset(p_account_risks) as z(review_date date,account_id uuid,risk_pct integer,trade_return_pct numeric) loop
      if x.risk_pct in (1,2)
         and exists(select 1 from public.daily_reviews where date=x.review_date and result in ('win','loss','break_even'))
         and exists(select 1 from public.tradeflow_accounts where id=x.account_id) then
        insert into public.daily_review_account_risks(review_date,account_id,risk_pct,trade_return_pct)
        values(x.review_date,x.account_id,x.risk_pct,x.trade_return_pct)
        on conflict(review_date,account_id) do update set risk_pct=excluded.risk_pct,trade_return_pct=excluded.trade_return_pct;
        update public.daily_reviews set account_managed=true where date=x.review_date;
      end if;
    end loop;
  end if;

  if p_theme in ('dark','light') then update public.user_settings set theme=p_theme where id=1; end if;
  perform public.tradeflow_recompute_growth_risk();
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.tradeflow_add_account_v3(text,text,numeric) from public;
revoke all on function public.tradeflow_update_account_v3(text,uuid,text,numeric) from public;
revoke all on function public.tradeflow_reset_account_v3(text,uuid) from public;
revoke all on function public.tradeflow_upsert_review_v2(text,date,text,text,text,jsonb) from public;
revoke all on function public.tradeflow_import_v3(text,jsonb,jsonb,jsonb,jsonb,text) from public;

grant execute on function public.tradeflow_add_account_v3(text,text,numeric) to anon;
grant execute on function public.tradeflow_update_account_v3(text,uuid,text,numeric) to anon;
grant execute on function public.tradeflow_reset_account_v3(text,uuid) to anon;
grant execute on function public.tradeflow_upsert_review_v2(text,date,text,text,text,jsonb) to anon;
grant execute on function public.tradeflow_import_v3(text,jsonb,jsonb,jsonb,jsonb,text) to anon;
grant execute on function public.tradeflow_bootstrap(text) to anon;
grant execute on function public.tradeflow_delete_review(text,date) to anon;

notify pgrst, 'reload schema';

-- Compatibility wrapper: any old internal call now uses the v11 growth-cycle engine.
-- ============================================================
-- V11.3 ONE-TIME REPAIR
--
-- Repair the known v11/v11.1 bug where setting Account Size could create a
-- reset marker today and hide valid earlier Trade Return % history.
-- This only adjusts accounts with exactly one reset dated TODAY and a return
-- record before today. Explicit future Reset Cycle actions remain untouched.
-- ============================================================

with repair as (
  select
    rr.account_id,
    min(ar.review_date) as first_return_date,
    count(distinct rr.id) as reset_count,
    min(rr.id) as reset_id,
    min(rr.reset_date) as reset_date
  from public.tradeflow_account_resets rr
  join public.daily_review_account_risks ar
    on ar.account_id = rr.account_id
   and ar.trade_return_pct is not null
  group by rr.account_id
), eligible as (
  select *
  from repair
  where reset_count = 1
    and reset_date = current_date
    and first_return_date < reset_date
)
update public.tradeflow_account_resets rr
set reset_date = e.first_return_date
from eligible e
where rr.id = e.reset_id;

create or replace function public.tradeflow_recompute_risk_discipline()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.tradeflow_recompute_growth_risk();
end;
$$;

notify pgrst, 'reload schema';


-- ============================================================
-- EXPLICIT RESET / BALANCE HISTORY FIX
-- ============================================================
-- TradeFlow v11.5 — Explicit Reset + Balance History Fix
-- Run after the current v11.x full SQL.
-- This does NOT change your PIN.

alter table public.tradeflow_account_resets
  add column if not exists is_explicit boolean not null default false;

-- All legacy reset rows are treated as non-explicit because older versions
-- created reset markers automatically when Account Size was configured.
-- From v11.5 onward, only the Reset Cycle button creates an explicit reset.

create or replace function public.tradeflow_reset_account_v3(
  p_token text,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;

  if not exists (
    select 1
    from public.tradeflow_accounts
    where id = p_account_id
      and account_size is not null
      and account_size > 0
  ) then
    raise exception 'Set Account Size before resetting the cycle';
  end if;

  insert into public.tradeflow_account_resets(account_id, reset_date, is_explicit)
  values(p_account_id, current_date, true);

  perform public.tradeflow_recompute_growth_risk();

  return jsonb_build_object('ok', true, 'reset_date', current_date);
end;
$$;

create or replace function public.tradeflow_recompute_growth_risk()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a record;
  r record;
  v_reset_date date;
  v_total numeric := 0;
  v_cycle integer := 3;
  v_before_cycle integer;
  v_after_cycle integer;
  v_two_used boolean := false;
  v_base_pct numeric;
  v_progress numeric;
  v_violation boolean;
  v_tolerance numeric := 0.000001;
begin
  update public.daily_review_account_risks
  set violated = false
  where trade_return_pct is not null;

  for a in
    select id, account_size
    from public.tradeflow_accounts
    where account_size is not null and account_size > 0
  loop
    v_reset_date := null;
    v_total := 0;
    v_cycle := 3;
    v_two_used := false;

    for r in
      select
        ar.review_date,
        ar.account_id,
        ar.risk_pct,
        ar.trade_return_pct,
        d.result,
        (
          select max(rr.reset_date)
          from public.tradeflow_account_resets rr
          where rr.account_id = a.id
            and rr.is_explicit = true
            and rr.reset_date <= ar.review_date
        ) as effective_reset_date
      from public.daily_review_account_risks ar
      join public.daily_reviews d on d.date = ar.review_date
      where ar.account_id = a.id
        and ar.trade_return_pct is not null
      order by ar.review_date, ar.created_at
    loop
      if v_reset_date is distinct from r.effective_reset_date then
        v_reset_date := r.effective_reset_date;
        v_total := 0;
        v_cycle := 3;
        v_two_used := false;
      end if;

      v_before_cycle := public.tradeflow_cycle_number(v_total);
      if v_before_cycle <> v_cycle then
        v_cycle := v_before_cycle;
        v_two_used := false;
      end if;

      v_base_pct := public.tradeflow_cycle_base_pct(v_before_cycle);
      v_progress := v_total - v_base_pct;
      v_violation := false;

      -- Existing special 2% rules: evaluated from PRE-TRADE account state.
      if r.risk_pct = 2 then
        if v_progress < 2 - v_tolerance then
          v_violation := true;
        end if;
        if v_two_used then
          v_violation := true;
        end if;
      end if;

      -- v11.8: a losing trade cannot lose more than the selected risk %
      -- and still count as Risk Management Followed. The real return is
      -- preserved and the trade is NOT blocked.
      if r.result = 'loss'
         and r.trade_return_pct < 0
         and abs(r.trade_return_pct) > r.risk_pct + v_tolerance then
        v_violation := true;
      end if;

      update public.daily_review_account_risks
      set violated = v_violation
      where review_date = r.review_date
        and account_id = r.account_id;

      if r.risk_pct = 2 then
        v_two_used := true;
      end if;

      v_total := v_total + coalesce(r.trade_return_pct, 0);
      v_after_cycle := public.tradeflow_cycle_number(v_total);

      if v_after_cycle <> v_before_cycle then
        v_cycle := v_after_cycle;
        v_two_used := false;
      else
        v_cycle := v_before_cycle;
      end if;
    end loop;
  end loop;

  update public.daily_reviews d
  set risk = case
      when exists (
        select 1
        from public.daily_review_account_risks ar
        where ar.review_date = d.date
          and ar.trade_return_pct is not null
          and ar.violated = true
      ) then 'broke'
      else 'followed'
    end,
    updated_at = now()
  where d.account_managed = true
    and d.result in ('win','loss','break_even')
    and exists (
      select 1
      from public.daily_review_account_risks ar
      where ar.review_date = d.date
        and ar.trade_return_pct is not null
    );
end;
$$;

-- Recompute existing data immediately using only explicit resets.
select public.tradeflow_recompute_growth_risk();

notify pgrst, 'reload schema';


-- ============================================================
-- GOALS FEATURE
-- ============================================================
-- TradeFlow v11.7 — Goals Feature
-- ADDITIVE UPDATE ONLY. Run this after your current TradeFlow SQL.
-- This does NOT change your 6-digit access code or existing trading data.

create table if not exists public.tradeflow_goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint tradeflow_goals_title_check check (char_length(btrim(title)) between 1 and 300),
  constraint tradeflow_goals_status_check check (status in ('active','completed')),
  constraint tradeflow_goals_completed_state_check check (
    (status = 'active' and completed_at is null)
    or
    (status = 'completed' and completed_at is not null)
  )
);

alter table public.tradeflow_goals enable row level security;

-- Keep the table private. The frontend uses SECURITY DEFINER RPCs only.
revoke all on table public.tradeflow_goals from anon;
revoke all on table public.tradeflow_goals from authenticated;

create or replace function public.tradeflow_list_goals(p_token text)
returns table (
  id uuid,
  title text,
  status text,
  created_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;

  return query
  select g.id, g.title, g.status, g.created_at, g.completed_at
  from public.tradeflow_goals g
  order by
    case when g.status = 'active' then 0 else 1 end,
    case when g.status = 'active' then g.created_at end desc,
    g.completed_at desc nulls last,
    g.created_at desc;
end;
$$;

create or replace function public.tradeflow_add_goal(
  p_token text,
  p_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_goal public.tradeflow_goals%rowtype;
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;

  if p_title is null or char_length(btrim(p_title)) = 0 then
    raise exception 'Goal title is required';
  end if;

  if char_length(btrim(p_title)) > 300 then
    raise exception 'Goal title is too long';
  end if;

  insert into public.tradeflow_goals(title, status)
  values (btrim(p_title), 'active')
  returning * into v_goal;

  return to_jsonb(v_goal);
end;
$$;

create or replace function public.tradeflow_complete_goal(
  p_token text,
  p_goal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_goal public.tradeflow_goals%rowtype;
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;

  update public.tradeflow_goals
  set status = 'completed',
      completed_at = now()
  where id = p_goal_id
    and status = 'active'
  returning * into v_goal;

  if not found then
    raise exception 'Active goal not found';
  end if;

  return to_jsonb(v_goal);
end;
$$;

create or replace function public.tradeflow_delete_goal(
  p_token text,
  p_goal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_deleted_id uuid;
begin
  if not public.tradeflow_session_valid(p_token) then
    raise exception 'Invalid or expired session';
  end if;

  delete from public.tradeflow_goals
  where id = p_goal_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Goal not found';
  end if;

  return jsonb_build_object('ok', true, 'id', v_deleted_id);
end;
$$;

revoke all on function public.tradeflow_list_goals(text) from public;
revoke all on function public.tradeflow_add_goal(text,text) from public;
revoke all on function public.tradeflow_complete_goal(text,uuid) from public;
revoke all on function public.tradeflow_delete_goal(text,uuid) from public;

grant execute on function public.tradeflow_list_goals(text) to anon;
grant execute on function public.tradeflow_add_goal(text,text) to anon;
grant execute on function public.tradeflow_complete_goal(text,uuid) to anon;
grant execute on function public.tradeflow_delete_goal(text,uuid) to anon;

notify pgrst, 'reload schema';


-- Final API schema refresh
notify pgrst, 'reload schema';
