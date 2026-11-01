-- TradeFlow v7: Trading Setup migration
-- Safe update for an existing Secure RPC + Break Even database.
-- Does NOT change your access code, Start Date, theme, or existing reviews.

-- 1) Add the new nullable setup field. Existing rows remain NULL.
alter table public.daily_reviews
  add column if not exists setup text null;

alter table public.daily_reviews
  drop constraint if exists daily_reviews_setup_check;

alter table public.daily_reviews
  add constraint daily_reviews_setup_check
  check (setup in ('setup_1','setup_2','setup_3','setup_4') or setup is null);

-- Keep old data valid. No Trade must always be N/A for Risk, Strategy, and Setup.
alter table public.daily_reviews
  drop constraint if exists daily_review_logic;

alter table public.daily_reviews
  add constraint daily_review_logic
  check (
    (result = 'no_trade' and risk is null and strategy is null and setup is null)
    or
    (result in ('win','loss','break_even')
      and risk is not null
      and strategy is not null
      and (setup is null or setup in ('setup_1','setup_2','setup_3','setup_4')))
    or
    (result is null
      and risk is not null
      and strategy is not null
      and (setup is null or setup in ('setup_1','setup_2','setup_3','setup_4')))
  );

-- 2) Replace the old save RPC with the setup-aware version.
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
declare
  v_row public.daily_reviews%rowtype;
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
    p_setup := null;
  else
    if p_risk not in ('followed','broke')
       or p_strategy not in ('followed','broke') then
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

-- 3) Update backup/import. Older backups with no setup remain valid and import as NULL.
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
declare
  r record;
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
        r.risk := null;
        r.strategy := null;
        r.setup := null;
      end if;

      if r.result in ('win','loss','break_even','no_trade')
         and (r.result = 'no_trade'
              or (r.risk in ('followed','broke')
                  and r.strategy in ('followed','broke')
                  and (r.setup is null or r.setup in ('setup_1','setup_2','setup_3','setup_4')))) then
        insert into public.daily_reviews(date,risk,strategy,setup,result)
        values(r.date,r.risk,r.strategy,r.setup,r.result)
        on conflict(date) do update set
          risk = excluded.risk,
          strategy = excluded.strategy,
          setup = excluded.setup,
          result = excluded.result,
          updated_at = now();
      end if;
    end loop;
  end if;

  if p_theme in ('dark','light') then
    update public.user_settings set theme = p_theme where id = 1;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- 4) Keep direct table access blocked and grant only controlled RPC execution.
revoke all on table public.daily_reviews from anon, authenticated;
revoke all on function public.tradeflow_upsert_review(text,date,text,text,text,text) from public;
revoke all on function public.tradeflow_import(text,jsonb,text) from public;

grant execute on function public.tradeflow_upsert_review(text,date,text,text,text,text) to anon;
grant execute on function public.tradeflow_import(text,jsonb,text) to anon;

notify pgrst, 'reload schema';
