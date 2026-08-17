begin;

set search_path = public, extensions;

select plan(23);

create or replace function pg_temp.statement_raises(statement text)
returns boolean
language plpgsql
as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end;
$$;

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000096', 'vk-manual-user@example.test'),
  ('00000000-0000-0000-0000-000000000097', 'vk-manual-admin@example.test'),
  ('00000000-0000-0000-0000-000000000098', 'vk-manual-other-admin@example.test')
on conflict (id) do update set email = excluded.email;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000096', 'user', 'VK Manual User'),
  ('00000000-0000-0000-0000-000000000097', 'admin', 'VK Manual Admin'),
  ('00000000-0000-0000-0000-000000000098', 'admin', 'VK Manual Other Admin')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

select ok(
  pg_temp.statement_raises('select count(*) from public.vk_manual_import_runs'),
  'anonymous users cannot read VK manual import runs'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000096', true);

select is(
  (select count(*) from public.vk_manual_import_runs),
  0::bigint,
  'ordinary authenticated users see no VK manual import runs through RLS'
);

select ok(
  pg_temp.statement_raises('select public.start_vk_manual_import()'),
  'non-admin cannot start a VK manual import'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000097', true);

select isnt(
  public.start_vk_manual_import() ->> 'runId',
  null::text,
  'administrator can claim a VK manual import'
);

select is(
  (select count(*) from public.vk_manual_import_runs),
  1::bigint,
  'administrator can read the claimed VK manual import run'
);

select is(
  (select status::text from public.vk_manual_import_runs order by started_at desc limit 1),
  'running',
  'a claimed VK manual import starts in running state'
);

select ok(
  pg_temp.statement_raises('select public.start_vk_manual_import()'),
  'a concurrent VK manual import is rejected'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000098', true);

select ok(
  pg_temp.statement_raises($$ select public.finish_vk_manual_import(
    (select id from public.vk_manual_import_runs order by started_at desc limit 1),
    'failed',
    null,
    'must not be accepted'
  ) $$),
  'another administrator cannot finish a run they did not request'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000097', true);

select lives_ok(
  $$ select public.finish_vk_manual_import(
    (select id from public.vk_manual_import_runs order by started_at desc limit 1),
    'succeeded',
    '{"insertedCount":1}'::jsonb,
    null
  ) $$,
  'requesting administrator can finish the VK manual import'
);

select is(
  (select status::text from public.vk_manual_import_runs order by started_at desc limit 1),
  'succeeded',
  'successful VK manual import stores a terminal status'
);

select is(
  (select summary ->> 'insertedCount' from public.vk_manual_import_runs order by started_at desc limit 1),
  '1',
  'successful VK manual import stores its summary'
);

select isnt(
  (select finished_at from public.vk_manual_import_runs order by started_at desc limit 1),
  null::timestamptz,
  'finished VK manual import stores its completion time'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000096', true);

select ok(
  pg_temp.statement_raises($$ select public.finish_vk_manual_import(
    '00000000-0000-0000-0000-000000000000',
    'failed',
    null,
    'forbidden'
  ) $$),
  'non-admin cannot finish a VK manual import'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000097', true);

select ok(
  pg_temp.statement_raises('select public.start_vk_manual_import()'),
  'a successful VK import starts a one-minute cooldown'
);

reset role;
update public.vk_manual_import_runs
set finished_at = now() - interval '1 minute 1 second'
where status in ('succeeded', 'partial');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000097', true);

select isnt(
  public.start_vk_manual_import() ->> 'runId',
  null::text,
  'VK manual import becomes available after the one-minute cooldown'
);

select is(
  (select count(*) from public.vk_manual_import_runs),
  2::bigint,
  'a later click creates a separate audited run'
);

select lives_ok(
  $$ select public.finish_vk_manual_import(
    (select id from public.vk_manual_import_runs where status = 'running' order by started_at desc limit 1),
    'partial',
    '{"failedCount":1,"succeededCount":1}'::jsonb,
    null
  ) $$,
  'a partially successful VK manual import can be completed'
);

select is(
  (select status::text from public.vk_manual_import_runs order by started_at desc limit 1),
  'partial',
  'partial VK manual import stores the expected terminal status'
);

reset role;
update public.vk_manual_import_runs
set finished_at = now() - interval '1 minute 1 second'
where status in ('succeeded', 'partial');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000097', true);

select isnt(
  public.start_vk_manual_import() ->> 'runId',
  null::text,
  'another VK import can start after a partial-result cooldown'
);

select lives_ok(
  $$ select public.finish_vk_manual_import(
    (select id from public.vk_manual_import_runs where status = 'running' order by started_at desc limit 1),
    'failed',
    null,
    'VK API unavailable'
  ) $$,
  'a failed VK manual import can be completed'
);

select is(
  (select status::text from public.vk_manual_import_runs order by started_at desc limit 1),
  'failed',
  'failed VK manual import stores the expected terminal status'
);

select isnt(
  public.start_vk_manual_import() ->> 'runId',
  null::text,
  'a failed VK import can be retried immediately'
);

select is(
  (select count(*) from public.vk_manual_import_runs),
  4::bigint,
  'every manual retry is stored as a separate audited run'
);

select * from finish();

rollback;
