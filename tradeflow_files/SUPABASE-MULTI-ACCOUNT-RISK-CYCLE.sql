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
