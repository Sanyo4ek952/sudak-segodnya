begin;

set search_path = public, extensions;

select plan(13);

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

delete from public.analytics_events
where organization_id::text like '21300000-%';
delete from public.publications
where id::text like '22300000-%';
delete from public.organization_members
where organization_id::text like '21300000-%';
delete from public.organizations
where id::text like '21300000-%';

alter table public.organization_members
  enable trigger protect_last_organization_owner_trigger;

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000041', 'analytics-user@example.test'),
  ('00000000-0000-0000-0000-000000000042', 'analytics-admin@example.test')
on conflict (id) do update set email = excluded.email;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000041', 'user', 'Analytics User'),
  ('00000000-0000-0000-0000-000000000042', 'admin', 'Analytics Admin')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

insert into public.organization_types (id, slug, name, sort_order)
values ('30300000-0000-0000-0000-000000000001', 'analytics-tests', 'Analytics Tests', 997)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.publication_categories (id, slug, name, sort_order)
values ('31300000-0000-0000-0000-000000000001', 'analytics-tests', 'Analytics Tests', 997)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.organizations (
  id, slug, name, description, phone, status, type_id, created_by
)
values
  (
    '21300000-0000-0000-0000-000000000001',
    'analytics-active',
    'Analytics Active',
    'Active organization for secure analytics tests',
    '+7 900 000-00-41',
    'active',
    (select id from public.organization_types where slug = 'analytics-tests'),
    '00000000-0000-0000-0000-000000000042'
  ),
  (
    '21300000-0000-0000-0000-000000000002',
    'analytics-other',
    'Analytics Other',
    'Other organization for secure analytics tests',
    '+7 900 000-00-42',
    'active',
    (select id from public.organization_types where slug = 'analytics-tests'),
    '00000000-0000-0000-0000-000000000042'
  );

insert into public.publications (
  id,
  organization_id,
  author_id,
  slug,
  type,
  status,
  title,
  description,
  category_id,
  starts_at,
  ends_at,
  valid_until,
  published_at,
  place,
  price_text,
  is_free,
  sort_published_at
)
values
  (
    '22300000-0000-0000-0000-000000000001',
    '21300000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000042',
    'analytics-public-event',
    'event',
    'published',
    'Analytics Public Event',
    'Complete event description',
    (select id from public.publication_categories where slug = 'analytics-tests'),
    now() + interval '1 day',
    now() + interval '1 day 2 hours',
    null,
    now(),
    'Sudak',
    'Бесплатно',
    true,
    now()
  ),
  (
    '22300000-0000-0000-0000-000000000002',
    '21300000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000042',
    'analytics-public-news',
    'news',
    'published',
    'Analytics Public News',
    'Complete news description',
    (select id from public.publication_categories where slug = 'analytics-tests'),
    null,
    null,
    now() + interval '2 days',
    now(),
    null,
    'Не применимо',
    false,
    now()
  ),
  (
    '22300000-0000-0000-0000-000000000003',
    '21300000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000042',
    'analytics-expired-news',
    'news',
    'published',
    'Analytics Expired News',
    'Complete expired description',
    (select id from public.publication_categories where slug = 'analytics-tests'),
    null,
    null,
    now() - interval '1 minute',
    now() - interval '2 days',
    null,
    'Не применимо',
    false,
    now() - interval '2 days'
  );

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.analytics_events (
      event_name, publication_id, anonymous_id
    ) values (
      'publication_view',
      '22300000-0000-0000-0000-000000000001',
      'direct-insert-blocked'
    ) $$
  ),
  'public role cannot insert analytics rows directly'
);

create temporary table first_analytics_event as
select public.track_public_analytics_event(
  'publication_view',
  '21300000-0000-0000-0000-000000000001',
  '22300000-0000-0000-0000-000000000001',
  null,
  '00000000-0000-0000-0000-000000000901',
  '{}'::jsonb
) as id;

select ok(
  (select id is not null from first_analytics_event),
  'valid public publication view is accepted through RPC'
);

select is(
  public.track_public_analytics_event(
    'publication_view',
    '21300000-0000-0000-0000-000000000001',
    '22300000-0000-0000-0000-000000000001',
    null,
    '00000000-0000-0000-0000-000000000901',
    '{}'::jsonb
  ),
  (select id from first_analytics_event),
  'repeated event inside deduplication window returns the existing event'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.track_public_analytics_event(
      'made_up_event', null, null, null,
      '00000000-0000-0000-0000-000000000902', '{}'::jsonb
    ) $$
  ),
  'unsupported analytics event is rejected'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.track_public_analytics_event(
      'publication_view',
      '21300000-0000-0000-0000-000000000002',
      '22300000-0000-0000-0000-000000000001',
      null,
      '00000000-0000-0000-0000-000000000903',
      '{}'::jsonb
    ) $$
  ),
  'mismatched organization and publication are rejected'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.track_public_analytics_event(
      'publication_view',
      '21300000-0000-0000-0000-000000000001',
      '22300000-0000-0000-0000-000000000003',
      null,
      '00000000-0000-0000-0000-000000000904',
      '{}'::jsonb
    ) $$
  ),
  'expired publication does not accept analytics'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.track_public_analytics_event(
      'calendar',
      '21300000-0000-0000-0000-000000000001',
      '22300000-0000-0000-0000-000000000002',
      null,
      '00000000-0000-0000-0000-000000000905',
      '{}'::jsonb
    ) $$
  ),
  'calendar event is accepted only for event publications'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', true);

select ok(
  pg_temp.statement_raises(
    $$ select public.admin_moderate_publication(
      '22300000-0000-0000-0000-000000000001',
      'hidden',
      'Unauthorized moderation'
    ) $$
  ),
  'non-admin cannot moderate a publication'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000042', true);

select ok(
  pg_temp.statement_raises(
    $$ select public.admin_moderate_publication(
      '22300000-0000-0000-0000-000000000001',
      'hidden',
      ''
    ) $$
  ),
  'administrator must provide a moderation reason'
);

select lives_ok(
  $$ select public.admin_moderate_publication(
    '22300000-0000-0000-0000-000000000001',
    'hidden',
    'Incorrect public information'
  ) $$,
  'administrator hides a publication with a reason'
);

select is(
  (
    select status::text
    from public.publications
    where id = '22300000-0000-0000-0000-000000000001'
  ),
  'hidden',
  'hidden status is distinct and persisted'
);

select ok(
  exists (
    select 1
    from public.audit_events
    where entity_type = 'publications'
      and entity_id = '22300000-0000-0000-0000-000000000001'
      and action = 'publications.status.hidden'
      and reason = 'Incorrect public information'
  ),
  'publication moderation reason is recorded in audit history'
);

select lives_ok(
  $$ select public.admin_moderate_organization(
    '21300000-0000-0000-0000-000000000002',
    'blocked',
    'Organization verification failed'
  ) $$,
  'administrator blocks an organization with a reason'
);

select * from finish();

rollback;

