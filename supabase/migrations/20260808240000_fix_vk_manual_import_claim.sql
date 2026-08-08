-- Avoid collision with PostgreSQL CURRENT_TIME (timetz) inside the cooldown
-- comparison. The claim timestamp must remain timestamptz.

create or replace function public.start_vk_manual_import()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  claimed_at timestamptz := now();
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
    and latest_started_at > claimed_at - interval '24 hours'
  then
    raise exception using
      errcode = '55000',
      message = 'VK manual import is available once every 24 hours',
      detail = (latest_started_at + interval '24 hours')::text;
  end if;

  insert into public.vk_manual_import_runs (requested_by, started_at)
  values (actor_id, claimed_at)
  returning id into run_id;

  return jsonb_build_object(
    'runId', run_id,
    'startedAt', claimed_at,
    'nextAvailableAt', claimed_at + interval '24 hours'
  );
end;
$$;

revoke all on function public.start_vk_manual_import()
  from public, anon, authenticated, service_role;
grant execute on function public.start_vk_manual_import() to authenticated;

notify pgrst, 'reload schema';
