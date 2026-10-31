-- TradeFlow v11.8 — Loss vs Selected Risk Validation
-- Optional additive patch for an already-working v11.7 database.
-- The FULL v11.8 SQL is delivered separately and is the recommended reference.

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

-- Recompute all managed historical records under the new rule.
select public.tradeflow_recompute_growth_risk();
notify pgrst, 'reload schema';
