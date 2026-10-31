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
  if p_code is null or p_code !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'message', 'Enter a valid 4-digit code.');
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
