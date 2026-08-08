-- VK import is started only by an administrator. PostgreSQL owns the rolling
-- 24-hour gate so stale tabs and concurrent clicks cannot bypass it.

do $$
begin
  create type public.vk_manual_import_run_status as enum (
    'running',
    'succeeded',
    'partial',
    'failed'
  );
exception when duplicate_object then null;
end $$;

create table public.vk_manual_import_runs (
  id uuid primary key default gen_random_uuid(),
  status public.vk_manual_import_run_status not null default 'running',
  requested_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb,
  error text,
  constraint vk_manual_import_runs_summary_object check (
    summary is null or jsonb_typeof(summary) = 'object'
  ),
  constraint vk_manual_import_runs_error_length check (
    error is null or char_length(error) <= 1000
  ),
  constraint vk_manual_import_runs_status_metadata check (
    (
      status = 'running'
      and finished_at is null
      and summary is null
      and error is null
    )
    or (
      status in ('succeeded', 'partial')
      and finished_at is not null
      and summary is not null
      and error is null
    )
    or (
      status = 'failed'
      and finished_at is not null
      and nullif(btrim(error), '') is not null
    )
  )
);

create index vk_manual_import_runs_started_at_idx
  on public.vk_manual_import_runs(started_at desc, id desc);

alter table public.vk_manual_import_runs enable row level security;

create policy "Admins can read VK manual import runs"
on public.vk_manual_import_runs for select to authenticated
using (public.is_admin());

revoke all on table public.vk_manual_import_runs from public, anon, authenticated;
grant select on table public.vk_manual_import_runs to authenticated;

create or replace function public.start_vk_manual_import()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  current_time timestamptz := now();
  latest_started_at timestamptz;
  run_id uuid;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  perform pg_advisory_xact_lock(20260808, 230000);

  select run.started_at
    into latest_started_at
  from public.vk_manual_import_runs run
  order by run.started_at desc, run.id desc
  limit 1;

  if latest_started_at is not null
    and latest_started_at > current_time - interval '24 hours'
  then
    raise exception using
      errcode = '55000',
      message = 'VK manual import is available once every 24 hours',
      detail = (latest_started_at + interval '24 hours')::text;
  end if;

  insert into public.vk_manual_import_runs (requested_by, started_at)
  values (actor_id, current_time)
  returning id into run_id;

  return jsonb_build_object(
    'runId', run_id,
    'startedAt', current_time,
    'nextAvailableAt', current_time + interval '24 hours'
  );
end;
$$;

revoke all on function public.start_vk_manual_import()
  from public, anon, authenticated, service_role;
grant execute on function public.start_vk_manual_import() to authenticated;

create or replace function public.finish_vk_manual_import(
  p_run_id uuid,
  p_status public.vk_manual_import_run_status,
  p_summary jsonb default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  run_record public.vk_manual_import_runs;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;
  if p_status = 'running' then
    raise exception using errcode = '22023', message = 'A finished VK import cannot remain running';
  end if;

  select run.*
    into run_record
  from public.vk_manual_import_runs run
  where run.id = p_run_id
  for update;

  if run_record.id is null then
    raise exception using errcode = '22023', message = 'VK manual import run not found';
  end if;
  if run_record.requested_by <> actor_id then
    raise exception using errcode = '42501', message = 'Only the requesting administrator can finish this VK import';
  end if;
  if run_record.status <> 'running' then
    raise exception using errcode = '55000', message = 'VK manual import run is already finished';
  end if;

  update public.vk_manual_import_runs
  set status = p_status,
      finished_at = now(),
      summary = case when p_status in ('succeeded', 'partial') then p_summary else null end,
      error = case when p_status = 'failed' then left(nullif(btrim(p_error), ''), 1000) else null end
  where id = run_record.id;
end;
$$;

revoke all on function public.finish_vk_manual_import(
  uuid,
  public.vk_manual_import_run_status,
  jsonb,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.finish_vk_manual_import(
  uuid,
  public.vk_manual_import_run_status,
  jsonb,
  text
) to authenticated;

notify pgrst, 'reload schema';
