-- TradeFlow Break Even migration
-- Safe to run on the existing Secure RPC v4 database.
-- This does NOT change the access code, Start Date, theme, or existing reviews.

-- 1) Allow break_even in the stored review result constraint.
alter table public.daily_reviews drop constraint if exists daily_reviews_result_check;
alter table public.daily_reviews drop constraint if exists daily_review_logic;

alter table public.daily_reviews
  add constraint daily_reviews_result_check
  check (result in ('win','loss','break_even','no_trade') or result is null);

alter table public.daily_reviews
  add constraint daily_review_logic
  check (
    (result = 'no_trade' and risk is null and strategy is null)
    or
    (result in ('win','loss','break_even') and risk is not null and strategy is not null)
    or
    (result is null and risk is not null and strategy is not null)
  );

-- 2) Update the secure review upsert RPC.
create or replace function public.tradeflow_upsert_review(
  p_token text,
  p_date date,
  p_risk text,
  p_strategy text,
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

  if p_result not in ('win','loss','break_even','no_trade') then
    raise exception 'Invalid result';
  end if;

  if p_result = 'no_trade' then
    p_risk := null;
    p_strategy := null;
  elsif p_risk not in ('followed','broke') or p_strategy not in ('followed','broke') then
    raise exception 'Risk and strategy are required';
  end if;

  insert into public.daily_reviews(date,risk,strategy,result)
  values (p_date,p_risk,p_strategy,p_result)
  on conflict (date) do update set
    risk = excluded.risk,
    strategy = excluded.strategy,
    result = excluded.result,
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object('review', to_jsonb(v_row));
end;
$$;

-- 3) Update secure backup/import so break_even survives exports/imports.
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
      as x(date date, risk text, strategy text, result text)
    loop
      if r.result = 'no_trade' then
        r.risk := null;
        r.strategy := null;
      end if;

      if r.result in ('win','loss','break_even','no_trade')
         and (r.result = 'no_trade' or (r.risk in ('followed','broke') and r.strategy in ('followed','broke'))) then
        insert into public.daily_reviews(date,risk,strategy,result)
        values(r.date,r.risk,r.strategy,r.result)
        on conflict(date) do update set
          risk=excluded.risk,
          strategy=excluded.strategy,
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

-- Keep only the controlled browser RPC grants.
revoke all on function public.tradeflow_upsert_review(text,date,text,text,text) from public;
revoke all on function public.tradeflow_import(text,jsonb,text) from public;
grant execute on function public.tradeflow_upsert_review(text,date,text,text,text) to anon;
grant execute on function public.tradeflow_import(text,jsonb,text) to anon;

notify pgrst, 'reload schema';
