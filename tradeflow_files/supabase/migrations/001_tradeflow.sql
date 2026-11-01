-- TradeFlow minimal Supabase schema
-- Source data only. Dashboard statistics are derived in the frontend.

create extension if not exists pgcrypto;

create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  risk text null check (risk in ('followed','broke')),
  strategy text null check (strategy in ('followed','broke')),
  result text null check (result in ('win','loss','no_trade')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_review_logic check (
    (result = 'no_trade' and risk is null and strategy is null)
    or
    (result in ('win','loss') and risk is not null and strategy is not null)
    or
    (result is null and risk is not null and strategy is not null)
  )
);

create table if not exists public.user_settings (
  id smallint primary key default 1 check (id = 1),
  official_start_date date not null default date '2026-10-22',
  theme text not null default 'dark' check (theme in ('dark','light')),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  lock_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_reviews_set_updated_at on public.daily_reviews;
create trigger daily_reviews_set_updated_at
before update on public.daily_reviews
for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

insert into public.user_settings (id, official_start_date, theme)
values (1, date '2026-10-22', 'dark')
on conflict (id) do nothing;

insert into public.daily_reviews (date, risk, strategy, result)
values (date '2026-10-22', 'followed', 'followed', 'loss')
on conflict (date) do nothing;

-- The browser does NOT query these tables directly.
-- Edge Functions use the server-side service role after verifying a TradeFlow session token.
alter table public.daily_reviews enable row level security;
alter table public.user_settings enable row level security;

revoke all on table public.daily_reviews from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;
grant all on table public.daily_reviews to service_role;
grant all on table public.user_settings to service_role;

comment on table public.daily_reviews is 'TradeFlow daily source data only. Derived statistics stay in the frontend.';
comment on table public.user_settings is 'Singleton TradeFlow settings row; id must remain 1.';
