begin;

set search_path = public, extensions;

select plan(16);

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

alter table public.organization_members
  disable trigger protect_last_organization_owner_trigger;

delete from public.publication_schedules
where publication_id::text like '22100000-%';
delete from public.publications
where id::text like '22100000-%';
delete from public.organization_members
where organization_id::text like '21100000-%';
delete from public.organizations
where id::text like '21100000-%';

alter table public.organization_members
  enable trigger protect_last_organization_owner_trigger;

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000021', 'publication-owner@example.test'),
  ('00000000-0000-0000-0000-000000000022', 'publication-manager@example.test'),
  ('00000000-0000-0000-0000-000000000023', 'publication-outsider@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000021', 'user', 'Publication Owner'),
  ('00000000-0000-0000-0000-000000000022', 'user', 'Publication Manager'),
  ('00000000-0000-0000-0000-000000000023', 'user', 'Publication Outsider')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

insert into public.organization_types (id, slug, name, sort_order)
values ('30100000-0000-0000-0000-000000000001', 'publication-tests', 'Publication Tests', 999)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.publication_categories (id, slug, name, sort_order)
values ('31100000-0000-0000-0000-000000000001', 'publication-tests', 'Publication Tests', 999)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.organizations (
  id, slug, name, description, phone, status, type_id, created_by,
  moderation_comment
)
values
  (
    '21100000-0000-0000-0000-000000000001',
    'secure-publication-active',
    'Secure Publication Active',
    'Active organization for secure publication tests',
    '+7 900 000-00-01',
    'active',
    (select id from public.organization_types where slug = 'publication-tests'),
    '00000000-0000-0000-0000-000000000021',
    null
  ),
  (
    '21100000-0000-0000-0000-000000000002',
    'secure-publication-foreign',
    'Secure Publication Foreign',
    'Foreign organization for secure publication tests',
    '+7 900 000-00-02',
    'active',
    (select id from public.organization_types where slug = 'publication-tests'),
    '00000000-0000-0000-0000-000000000023',
    null
  ),
  (
    '21100000-0000-0000-0000-000000000003',
    'secure-publication-blocked',
    'Secure Publication Blocked',
    'Blocked organization for secure publication tests',
    '+7 900 000-00-03',
    'blocked',
    (select id from public.organization_types where slug = 'publication-tests'),
    '00000000-0000-0000-0000-000000000021',
    'Blocked fixture'
  );

insert into public.organization_members (organization_id, user_id, role, is_active)
values
  ('21100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'owner', true),
  ('21100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000022', 'manager', true),
  ('21100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000023', 'owner', true),
  ('21100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000022', 'manager', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000023', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  pg_temp.statement_raises(
    $$ select public.save_member_publication(
      '21100000-0000-0000-0000-000000000001',
      '22100000-0000-0000-0000-000000000001',
      '23100000-0000-0000-0000-000000000001',
      'draft', 'news', 'Outsider draft', null,
      '31100000-0000-0000-0000-000000000001',
      null, null, null, null, null, null, false, null, null, '[]'::jsonb
    ) $$
  ),
  'user without membership cannot create a publication'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);

select ok(
  not pg_temp.statement_raises(
    $$ select public.save_member_publication(
      '21100000-0000-0000-0000-000000000001',
      '22100000-0000-0000-0000-000000000002',
      '23100000-0000-0000-0000-000000000002',
      'draft', 'news', 'Manager draft', null,
      '31100000-0000-0000-0000-000000000001',
      null, null, null, null, null, null, false, null, null, '[]'::jsonb
    ) $$
  ),
  'manager of active organization creates a draft'
);

select is(
  (
    select status::text
    from public.save_member_publication(
      '21100000-0000-0000-0000-000000000001',
      '22100000-0000-0000-0000-000000000003',
      '23100000-0000-0000-0000-000000000003',
      'publish', 'event', 'Manager event', 'Complete event description',
      '31100000-0000-0000-0000-000000000001',
      now() + interval '1 day', now() + interval '1 day 2 hours',
      null, null, 'Sudak embankment', '500 ₽', false, '6+', null, '[]'::jsonb
    )
  ),
  'published',
  'manager publishes a valid event through RPC'
);

select is(
  (
    select author_id
    from public.publications
    where id = '22100000-0000-0000-0000-000000000003'
  ),
  '00000000-0000-0000-0000-000000000022'::uuid,
  'RPC derives author from auth context'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.save_member_publication(
      '21100000-0000-0000-0000-000000000002',
      '22100000-0000-0000-0000-000000000003',
      '23100000-0000-0000-0000-000000000004',
      'publish', 'event', 'Foreign edit', 'Complete event description',
      '31100000-0000-0000-0000-000000000001',
      now() + interval '1 day', now() + interval '1 day 2 hours',
      null, null, 'Sudak', '500 ₽', false, null, null, '[]'::jsonb
    ) $$
  ),
  'manager cannot publish or edit for another organization'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000021', true);

select is(
  (
    select title
    from public.save_member_publication(
      '21100000-0000-0000-0000-000000000001',
      '22100000-0000-0000-0000-000000000003',
      '23100000-0000-0000-0000-000000000003',
      'publish', 'event', 'Owner edited event', 'Description edited by owner',
      '31100000-0000-0000-0000-000000000001',
      now() + interval '1 day', now() + interval '1 day 3 hours',
      null, null, 'Sudak embankment', '600 ₽', false, '6+', null, '[]'::jsonb
    )
  ),
  'Owner edited event',
  'owner edits an already published publication'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000022', true);

select is(
  (
    select title
    from public.save_member_publication(
      '21100000-0000-0000-0000-000000000001',
      '22100000-0000-0000-0000-000000000003',
      '23100000-0000-0000-0000-000000000003',
      'publish', 'event', 'Manager edited event', 'Description edited by manager',
      '31100000-0000-0000-0000-000000000001',
      now() + interval '1 day', now() + interval '1 day 3 hours',
      null, null, 'Sudak embankment', '600 ₽', false, '6+', null, '[]'::jsonb
    )
  ),
  'Manager edited event',
  'manager edits an already published publication'
);

update public.publications
set status = 'hidden'
where id = '22100000-0000-0000-0000-000000000003';

select is(
  (
    select status::text
    from public.publications
    where id = '22100000-0000-0000-0000-000000000003'
  ),
  'published',
  'RLS prevents a representative from setting hidden directly'
);

update public.publications
set status = 'blocked'
where id = '22100000-0000-0000-0000-000000000003';

select is(
  (
    select status::text
    from public.publications
    where id = '22100000-0000-0000-0000-000000000003'
  ),
  'published',
  'RLS prevents a representative from setting blocked directly'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.save_member_publication(
      '21100000-0000-0000-0000-000000000003',
      '22100000-0000-0000-0000-000000000004',
      '23100000-0000-0000-0000-000000000004',
      'publish', 'news', 'Blocked organization news', 'Complete news description',
      '31100000-0000-0000-0000-000000000001',
      null, null, now() + interval '1 day', null, null, null, false, null, null, '[]'::jsonb
    ) $$
  ),
  'inactive organization cannot publish'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.save_member_publication(
      '21100000-0000-0000-0000-000000000001',
      '22100000-0000-0000-0000-000000000005',
      '23100000-0000-0000-0000-000000000005',
      'publish', 'news', 'News without validity', 'Complete news description',
      '31100000-0000-0000-0000-000000000001',
      null, null, null, null, null, null, false, null, null, '[]'::jsonb
    ) $$
  ),
  'news without valid_until is rejected'
);

select lives_ok(
  $$ select public.save_member_publication(
    '21100000-0000-0000-0000-000000000001',
    '22100000-0000-0000-0000-000000000006',
    '23100000-0000-0000-0000-000000000006',
    'publish', 'regular', 'Regular activity', 'Complete regular activity description',
    '31100000-0000-0000-0000-000000000001',
    null, null, now() + interval '30 days', null, 'Sudak studio', '1000 ₽', false, null, null,
    '[{"schedule_text":"Mondays at 18:00","weekday":1,"starts_at":"18:00","ends_at":"19:00","sort_order":0,"timezone":"Europe/Moscow"}]'::jsonb
  ) $$,
  'regular publication and schedule save in one RPC call'
);

select is(
  (
    select count(*)
    from public.publication_schedules
    where publication_id = '22100000-0000-0000-0000-000000000006'
      and weekday = 1
  ),
  1::bigint,
  'regular schedule row is persisted atomically'
);

select public.save_member_publication(
  '21100000-0000-0000-0000-000000000001',
  '22100000-0000-0000-0000-000000000007',
  '23100000-0000-0000-0000-000000000007',
  'draft', 'news', 'Idempotent draft', null,
  '31100000-0000-0000-0000-000000000001',
  null, null, null, null, null, null, false, null, null, '[]'::jsonb
);
select public.save_member_publication(
  '21100000-0000-0000-0000-000000000001',
  '22100000-0000-0000-0000-000000000007',
  '23100000-0000-0000-0000-000000000007',
  'draft', 'news', 'Idempotent draft', null,
  '31100000-0000-0000-0000-000000000001',
  null, null, null, null, null, null, false, null, null, '[]'::jsonb
);

select is(
  (
    select count(*)
    from public.publications
    where organization_id = '21100000-0000-0000-0000-000000000001'
      and client_request_id = '23100000-0000-0000-0000-000000000007'
  ),
  1::bigint,
  'repeated request does not create a duplicate'
);

select is(
  (
    select status::text
    from public.save_member_publication(
      '21100000-0000-0000-0000-000000000001',
      '22100000-0000-0000-0000-000000000008',
      '23100000-0000-0000-0000-000000000008',
      'schedule', 'news', 'Scheduled news', 'Complete scheduled news description',
      '31100000-0000-0000-0000-000000000001',
      null, null, now() + interval '10 days', now() + interval '1 day',
      null, null, false, null, null, '[]'::jsonb
    )
  ),
  'scheduled',
  'valid future publication can be scheduled'
);

reset role;
update public.publications
set publish_at = now() - interval '1 minute'
where id = '22100000-0000-0000-0000-000000000008';
select public.publish_due_publications(100);

select is(
  (
    select status::text
    from public.publications
    where id = '22100000-0000-0000-0000-000000000008'
  ),
  'published',
  'due scheduled publication is published by background function'
);

select * from finish();

rollback;
