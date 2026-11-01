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
