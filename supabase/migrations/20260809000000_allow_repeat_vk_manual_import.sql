-- Allow administrators to repeat VK imports on demand while keeping a single
-- active run and a short cooldown after successful completion.

create or replace function public.start_vk_manual_import()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  claimed_at timestamptz := now();
  active_run_id uuid;
  active_started_at timestamptz;
  cooldown_until timestamptz;
  run_id uuid;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  perform pg_advisory_xact_lock(20260808, 230000);

  select run.id, run.started_at
    into active_run_id, active_started_at
  from public.vk_manual_import_runs run
  where run.status = 'running'
  order by run.started_at desc, run.id desc
  limit 1;

  if active_run_id is not null
    and active_started_at > claimed_at - interval '5 minutes'
  then
    raise exception using
      errcode = '55000',
      message = 'VK manual import is already running',
      detail = (active_started_at + interval '5 minutes')::text;
  end if;

  update public.vk_manual_import_runs
  set status = 'failed',
      finished_at = claimed_at,
      summary = null,
      error = 'VK import run expired before completion'
  where status = 'running'
    and started_at <= claimed_at - interval '5 minutes';

  select max(run.finished_at) + interval '1 minute'
    into cooldown_until
  from public.vk_manual_import_runs run
  where run.status in ('succeeded', 'partial')
    and run.finished_at is not null;

  if cooldown_until is not null and cooldown_until > claimed_at then
    raise exception using
      errcode = '55000',
      message = 'VK manual import is cooling down',
      detail = cooldown_until::text;
  end if;

  insert into public.vk_manual_import_runs (requested_by, started_at)
  values (actor_id, claimed_at)
  returning id into run_id;

  return jsonb_build_object(
    'runId', run_id,
    'startedAt', claimed_at
  );
end;
$$;

revoke all on function public.start_vk_manual_import()
  from public, anon, authenticated, service_role;
grant execute on function public.start_vk_manual_import() to authenticated;

notify pgrst, 'reload schema';
