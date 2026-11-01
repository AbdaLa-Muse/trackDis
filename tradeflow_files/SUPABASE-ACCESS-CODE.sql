-- TradeFlow: store and verify the 4-digit access code inside Supabase.
-- IMPORTANT: Before running, replace YOUR_6_DIGIT_CODE below with your real 4-digit code.

create extension if not exists pgcrypto;

create table if not exists public.app_access (
  id smallint primary key default 1 check (id = 1),
  access_code_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_access enable row level security;

-- The browser must never be allowed to read the stored hash directly.
revoke all on table public.app_access from anon, authenticated;

-- Store/update the code as a bcrypt hash. Change ONLY the value in quotes.
insert into public.app_access (id, access_code_hash, updated_at)
values (1, crypt('YOUR_6_DIGIT_CODE', gen_salt('bf')), now())
on conflict (id) do update
set access_code_hash = excluded.access_code_hash,
    updated_at = now();

create or replace function public.verify_access_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stored_hash text;
begin
  -- Accept exactly four digits only.
  if p_code is null or p_code !~ '^[0-9]{4}$' then
    return false;
  end if;

  select access_code_hash
    into stored_hash
  from public.app_access
  where id = 1;

  if stored_hash is null then
    return false;
  end if;

  return crypt(p_code, stored_hash) = stored_hash;
end;
$$;

revoke all on function public.verify_access_code(text) from public;
grant execute on function public.verify_access_code(text) to anon, authenticated;
