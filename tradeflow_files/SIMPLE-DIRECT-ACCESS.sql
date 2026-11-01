-- TradeFlow SIMPLE personal-app access patch
-- Run this in Supabase SQL Editor AFTER the original schema.
-- It allows the browser publishable key to read/write the two TradeFlow tables.
-- The 6-digit code remains a frontend convenience lock, not server-side security.

grant select, insert, update, delete on table public.daily_reviews to anon;
grant select, insert, update, delete on table public.user_settings to anon;

drop policy if exists "tradeflow_simple_daily_reviews_all" on public.daily_reviews;
create policy "tradeflow_simple_daily_reviews_all"
on public.daily_reviews
for all
to anon
using (true)
with check (true);

drop policy if exists "tradeflow_simple_user_settings_all" on public.user_settings;
create policy "tradeflow_simple_user_settings_all"
on public.user_settings
for all
to anon
using (true)
with check (true);

-- Re-assert the locked start date and initial review.
insert into public.user_settings (id, official_start_date, theme)
values (1, date '2026-10-22', 'dark')
on conflict (id) do update
set official_start_date = date '2026-10-22';

insert into public.daily_reviews (date, risk, strategy, result)
values (date '2026-10-22', 'followed', 'followed', 'loss')
on conflict (date) do update
set risk = excluded.risk,
    strategy = excluded.strategy,
    result = excluded.result;
