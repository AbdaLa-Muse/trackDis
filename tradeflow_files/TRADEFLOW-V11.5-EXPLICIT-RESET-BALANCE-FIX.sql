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
        (
          select max(rr.reset_date)
          from public.tradeflow_account_resets rr
          where rr.account_id = a.id
            and rr.is_explicit = true
            and rr.reset_date <= ar.review_date
        ) as effective_reset_date
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
        if v_progress < 2 then
          v_violation := true;
        end if;
        if v_two_used then
          v_violation := true;
        end if;
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
