begin;

set search_path = public, extensions;

select plan(37);

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
  ('00000000-0000-0000-0000-000000000081', 'ingestion-user@example.test'),
  ('00000000-0000-0000-0000-000000000082', 'ingestion-admin@example.test'),
  ('00000000-0000-0000-0000-000000000083', 'ingestion-applicant@example.test')
on conflict (id) do update set email = excluded.email;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000081', 'user', 'Ingestion User'),
  ('00000000-0000-0000-0000-000000000082', 'admin', 'Ingestion Admin'),
  ('00000000-0000-0000-0000-000000000083', 'user', 'Ingestion Applicant')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

insert into public.organization_types (id, slug, name, sort_order)
values ('30800000-0000-0000-0000-000000000001', 'ingestion-tests', 'Ingestion Tests', 997)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.publication_categories (id, slug, name, sort_order)
values ('31800000-0000-0000-0000-000000000001', 'ingestion-tests', 'Ingestion Tests', 997)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.organizations (
  id, slug, name, description, phone, status, type_id, created_by, last_public_update_at
)
values (
  '41800000-0000-0000-0000-000000000001',
  'ingestion-existing-organization',
  'Ingestion Existing Organization',
  'Active organization for ingestion publication tests',
  '+7 900 000-08-01',
  'active',
  '30800000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000082',
  now()
);

insert into public.organization_members (organization_id, user_id, role, is_active)
values (
  '41800000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000081',
  'owner',
  true
);

insert into public.publications (
  id, organization_id, author_id, slug, type, status, title, description,
  category_id, valid_until, published_at, sort_published_at, price_text
)
values
  (
    '42800000-0000-0000-0000-000000000001',
    '41800000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000082',
    'ingestion-cancel-target',
    'news',
    'published',
    'Publication to cancel',
    'Complete description for the cancellation target',
    '31800000-0000-0000-0000-000000000001',
    now() + interval '20 days',
    now(),
    now(),
    'Не применяется'
  ),
  (
    '42800000-0000-0000-0000-000000000002',
    '41800000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000082',
    'ingestion-update-target',
    'news',
    'published',
    'Publication to update',
    'Complete description before the imported update',
    '31800000-0000-0000-0000-000000000001',
    now() + interval '20 days',
    now(),
    now(),
    'Не применяется'
  );

insert into public.content_sources (
  id, name, kind, url, canonical_url, trust_level, is_active,
  fetch_interval_minutes, next_check_at, created_by
)
values (
  '50800000-0000-0000-0000-000000000001',
  'Official ingestion fixture',
  'html',
  'https://example.test/sudak',
  'https://example.test/sudak',
  'official',
  true,
  1440,
  now() - interval '1 minute',
  '00000000-0000-0000-0000-000000000082'
);

insert into public.content_ingestion_runs (
  id, source_id, trigger, status, idempotency_key, created_by, started_at
)
values (
  '51800000-0000-0000-0000-000000000001',
  '50800000-0000-0000-0000-000000000001',
  'agent',
  'running',
  'ingestion-pgtap-run',
  '00000000-0000-0000-0000-000000000082',
  now()
);

insert into public.content_candidates (
  id, source_id, run_id, action, status, payload, evidence, warnings,
  source_url, source_checked_at, content_hash, normalized_fingerprint,
  target_organization_id, target_publication_id, duplicate_of_id
)
values
  (
    '52800000-0000-0000-0000-000000000001',
    '50800000-0000-0000-0000-000000000001',
    '51800000-0000-0000-0000-000000000001',
    'create_organization',
    'pending',
    jsonb_build_object(
      'kind', 'organization',
      'name', 'Imported Ownerless Organization',
      'typeSlug', 'ingestion-tests',
      'description', 'Complete imported organization description',
      'address', 'Sudak',
      'phone', '+7 900 000-08-02',
      'workingHours', 'Daily 10:00–20:00',
      'contactLinks', jsonb_build_array(
        jsonb_build_object('label', 'Сайт', 'href', 'https://example.test/imported')
      )
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    'https://example.test/organization', now(), 'hash-org', 'fingerprint-org',
    null, null, null
  ),
  (
    '52800000-0000-0000-0000-000000000002',
    '50800000-0000-0000-0000-000000000001',
    '51800000-0000-0000-0000-000000000001',
    'create_publication',
    'pending',
    jsonb_build_object(
      'kind', 'publication',
      'organizationId', '41800000-0000-0000-0000-000000000001',
      'organizationName', 'Ingestion Existing Organization',
      'targetPublicationId', null,
      'type', 'regular',
      'title', 'Imported regular activity',
      'description', 'Complete description for an imported regular activity',
      'categorySlug', 'ingestion-tests',
      'startsAt', null,
      'endsAt', null,
      'validUntil', (now() + interval '30 days')::text,
      'place', 'Sudak studio',
      'priceText', '1000 ₽',
      'isFree', false,
      'ageLimit', '6+',
      'contactPhone', '+7 900 000-08-01',
      'scheduleEntries', jsonb_build_array(jsonb_build_object(
        'scheduleText', 'Mondays at 18:00',
        'weekday', 1,
        'startsAt', '18:00',
        'endsAt', '19:00',
        'sortOrder', 0,
        'timezone', 'Europe/Moscow'
      )),
      'imageSourceUrl', null
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    'https://example.test/regular', now(), 'hash-regular', 'fingerprint-regular',
    '41800000-0000-0000-0000-000000000001', null, null
  ),
  (
    '52800000-0000-0000-0000-000000000003',
    '50800000-0000-0000-0000-000000000001',
    '51800000-0000-0000-0000-000000000001',
    'create_publication',
    'duplicate',
    jsonb_build_object(
      'kind', 'publication',
      'organizationId', '41800000-0000-0000-0000-000000000001',
      'organizationName', 'Ingestion Existing Organization',
      'targetPublicationId', null,
      'type', 'news',
      'title', 'Possible duplicate',
      'description', 'Complete possible duplicate description',
      'categorySlug', 'ingestion-tests',
      'startsAt', null,
      'endsAt', null,
      'validUntil', (now() + interval '10 days')::text,
      'place', null,
      'priceText', null,
      'isFree', false,
      'ageLimit', null,
      'contactPhone', null,
      'scheduleEntries', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    'https://example.test/duplicate', now(), 'hash-duplicate', 'fingerprint-duplicate',
    '41800000-0000-0000-0000-000000000001', null,
    '52800000-0000-0000-0000-000000000002'
  ),
  (
    '52800000-0000-0000-0000-000000000004',
    '50800000-0000-0000-0000-000000000001',
    '51800000-0000-0000-0000-000000000001',
    'create_publication',
    'pending',
    jsonb_build_object(
      'kind', 'publication',
      'organizationId', '41800000-0000-0000-0000-000000000001',
      'organizationName', 'Ingestion Existing Organization',
      'targetPublicationId', null,
      'type', 'news',
      'title', 'Candidate to reject',
      'description', null,
      'categorySlug', 'ingestion-tests',
      'startsAt', null,
      'endsAt', null,
      'validUntil', null,
      'place', null,
      'priceText', null,
      'isFree', false,
      'ageLimit', null,
      'contactPhone', null,
      'scheduleEntries', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    'https://example.test/reject', now(), 'hash-reject', 'fingerprint-reject',
    '41800000-0000-0000-0000-000000000001', null, null
  ),
  (
    '52800000-0000-0000-0000-000000000005',
    '50800000-0000-0000-0000-000000000001',
    '51800000-0000-0000-0000-000000000001',
    'create_publication',
    'pending',
    jsonb_build_object(
      'kind', 'publication',
      'organizationId', '41800000-0000-0000-0000-000000000001',
      'organizationName', 'Ingestion Existing Organization',
      'targetPublicationId', null,
      'type', 'news',
      'title', 'Incomplete imported draft',
      'description', null,
      'categorySlug', 'ingestion-tests',
      'startsAt', null,
      'endsAt', null,
      'validUntil', null,
      'place', null,
      'priceText', null,
      'isFree', false,
      'ageLimit', null,
      'contactPhone', null,
      'scheduleEntries', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    'https://example.test/draft', now(), 'hash-draft', 'fingerprint-draft',
    '41800000-0000-0000-0000-000000000001', null, null
  ),
  (
    '52800000-0000-0000-0000-000000000006',
    '50800000-0000-0000-0000-000000000001',
    '51800000-0000-0000-0000-000000000001',
    'update_publication',
    'pending',
    jsonb_build_object(
      'kind', 'publication',
      'organizationId', '41800000-0000-0000-0000-000000000001',
      'organizationName', 'Ingestion Existing Organization',
      'targetPublicationId', '42800000-0000-0000-0000-000000000002',
      'type', 'news',
      'title', 'Updated by ingestion review',
      'description', 'Complete updated description from an official source',
      'categorySlug', 'ingestion-tests',
      'startsAt', null,
      'endsAt', null,
      'validUntil', (now() + interval '7 days')::text,
      'sourcePublishedAt', now()::text,
      'place', null,
      'priceText', null,
      'isFree', false,
      'ageLimit', null,
      'contactPhone', null,
      'scheduleEntries', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    'https://example.test/update', now(), 'hash-update', 'fingerprint-update',
    '41800000-0000-0000-0000-000000000001',
    '42800000-0000-0000-0000-000000000002', null
  ),
  (
    '52800000-0000-0000-0000-000000000007',
    '50800000-0000-0000-0000-000000000001',
    '51800000-0000-0000-0000-000000000001',
    'cancel_publication',
    'pending',
    jsonb_build_object(
      'kind', 'publication',
      'organizationId', '41800000-0000-0000-0000-000000000001',
      'organizationName', 'Ingestion Existing Organization',
      'targetPublicationId', '42800000-0000-0000-0000-000000000001',
      'type', 'news',
      'title', 'Cancelled event notice',
      'description', 'The source explicitly confirms cancellation',
      'categorySlug', 'ingestion-tests',
      'startsAt', null,
      'endsAt', null,
      'validUntil', (now() + interval '20 days')::text,
      'place', null,
      'priceText', null,
      'isFree', false,
      'ageLimit', null,
      'contactPhone', null,
      'scheduleEntries', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    jsonb_build_array(jsonb_build_object(
      'field', 'description',
      'excerpt', 'Мероприятие отменено организатором',
      'sourceUrl', 'https://example.test/cancel'
    )),
    '[]'::jsonb,
    'https://example.test/cancel', now(), 'hash-cancel', 'fingerprint-cancel',
    '41800000-0000-0000-0000-000000000001',
    '42800000-0000-0000-0000-000000000001', null
  );

update public.content_candidates
set evidence = jsonb_build_array(jsonb_build_object(
  'field', 'fixture',
  'excerpt', 'Verified primary-source fixture',
  'sourceUrl', source_url
))
where id in (
  '52800000-0000-0000-0000-000000000001',
  '52800000-0000-0000-0000-000000000002',
  '52800000-0000-0000-0000-000000000006'
);

insert into public.content_candidates (
  id, source_id, run_id, action, status, payload, evidence, warnings,
  source_url, source_checked_at, content_hash, normalized_fingerprint
)
select
  '52800000-0000-0000-0000-000000000008', source_id, run_id, action, 'pending',
  jsonb_set(payload, '{name}', to_jsonb('Imported Organization Without Evidence'::text)),
  '[]'::jsonb, warnings, 'https://example.test/no-evidence', source_checked_at,
  'hash-no-evidence', 'fingerprint-no-evidence'
from public.content_candidates
where id = '52800000-0000-0000-0000-000000000001';

insert into public.organization_applications (
  id, applicant_id, status, organization_name, type_id, description,
  address, phone, relationship, submitted_at
)
values (
  '53800000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000083',
  'submitted',
  'Imported Ownerless Organization',
  '30800000-0000-0000-0000-000000000001',
  'Application for the imported ownerless organization',
  'Sudak',
  '+7 900 000-08-02',
  'Owner',
  now()
);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

select ok(
  pg_temp.statement_raises('select count(*) from public.content_candidates'),
  'anonymous users cannot read the ingestion queue'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', true);

select is(
  (
    select count(*)
    from public.content_candidates
    where id between '52800000-0000-0000-0000-000000000001'::uuid
      and '52800000-0000-0000-0000-000000000007'::uuid
  ),
  0::bigint,
  'ordinary authenticated users see no candidates through RLS'
);

select is(
  (
    select count(*)
    from public.audit_events
    where entity_type in ('content_candidates', 'content_sources', 'content_ingestion_runs')
  ),
  0::bigint,
  'organization owners cannot read closed ingestion details through audit events'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.review_content_candidate(
      '52800000-0000-0000-0000-000000000001', 'approve_publish', null, null
    ) $$
  ),
  'ordinary user cannot review a candidate'
);

select ok(
  pg_temp.statement_raises('select * from public.claim_due_content_sources(5)'),
  'authenticated role cannot claim due sources'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', true);

select is(
  (
    select count(*)
    from public.content_candidates
    where id in (
      '52800000-0000-0000-0000-000000000001',
      '52800000-0000-0000-0000-000000000002',
      '52800000-0000-0000-0000-000000000003',
      '52800000-0000-0000-0000-000000000004',
      '52800000-0000-0000-0000-000000000005',
      '52800000-0000-0000-0000-000000000006',
      '52800000-0000-0000-0000-000000000007',
      '52800000-0000-0000-0000-000000000008'
    )
  ),
  8::bigint,
  'administrator can read all queued candidates'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.review_content_candidate(
      '52800000-0000-0000-0000-000000000008', 'approve_publish', null, null
    ) $$
  ),
  'candidate without verified source evidence cannot be published'
);

select ok(
  pg_temp.statement_raises(
    $$ update public.content_candidates
       set status = 'approved'
       where id = '52800000-0000-0000-0000-000000000001' $$
  ),
  'administrator cannot bypass the review RPC by setting a final status directly'
);

select lives_ok(
  $$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000001', 'approve_publish', null, null
  ) $$,
  'administrator approves a complete imported organization'
);

select ok(
  exists (
    select 1
    from public.organizations organization_record
    join public.content_candidates candidate
      on candidate.result_organization_id = organization_record.id
    where candidate.id = '52800000-0000-0000-0000-000000000001'
      and organization_record.status = 'active'
      and organization_record.type_id = '30800000-0000-0000-0000-000000000001'
  ),
  'approved organization is active and uses the selected type'
);

select is(
  (
    select count(*)
    from public.organization_members member_record
    join public.content_candidates candidate
      on candidate.result_organization_id = member_record.organization_id
    where candidate.id = '52800000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'imported organization is created without an automatic representative'
);

select lives_ok(
  $$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000001', 'approve_publish', null, null
  ) $$,
  'repeated organization approval is idempotent'
);

select lives_ok(
  $$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000002', 'approve_publish', null, null
  ) $$,
  'administrator publishes a valid regular activity'
);

select is(
  (
    select publication.status::text
    from public.publications publication
    join public.content_candidates candidate
      on candidate.result_publication_id = publication.id
    where candidate.id = '52800000-0000-0000-0000-000000000002'
  ),
  'published',
  'approved publication has published status'
);

select is(
  (
    select count(*)
    from public.publication_schedules schedule
    join public.content_candidates candidate
      on candidate.result_publication_id = schedule.publication_id
    where candidate.id = '52800000-0000-0000-0000-000000000002'
      and schedule.weekday = 1
      and schedule.timezone = 'Europe/Moscow'
  ),
  1::bigint,
  'regular activity schedule is saved atomically in Moscow timezone'
);

select lives_ok(
  $$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000002', 'approve_publish', null, null
  ) $$,
  'repeated publication approval is idempotent'
);

select is(
  (
    select count(*)
    from public.publications
    where client_request_id = '52800000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'repeated review creates only one publication'
);

select lives_ok(
  $$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000005', 'approve_draft', null, null
  ) $$,
  'incomplete publication may be saved as a draft'
);

select is(
  (
    select publication.status::text
    from public.publications publication
    join public.content_candidates candidate
      on candidate.result_publication_id = publication.id
    where candidate.id = '52800000-0000-0000-0000-000000000005'
  ),
  'draft',
  'approve_draft never exposes incomplete content'
);

select lives_ok(
  $$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000006', 'approve_publish', null, null
  ) $$,
  'administrator applies an imported publication update'
);

select is(
  (select title from public.publications where id = '42800000-0000-0000-0000-000000000002'),
  'Updated by ingestion review',
  'update candidate changes the target publication'
);

select lives_ok(
  $$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000007', 'approve_publish', null, null
  ) $$,
  'administrator applies an explicitly sourced cancellation'
);

select is(
  (select status::text from public.publications where id = '42800000-0000-0000-0000-000000000001'),
  'cancelled',
  'cancellation candidate transitions the publication to cancelled'
);

select lives_ok(
  $$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000003', 'mark_not_duplicate', null, null
  ) $$,
  'administrator can clear a duplicate match'
);

select is(
  (select status::text from public.content_candidates where id = '52800000-0000-0000-0000-000000000003'),
  'pending',
  'cleared duplicate returns to the pending queue'
);

select lives_ok(
  $$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000004', 'reject', null, 'Source is not authoritative'
  ) $$,
  'administrator rejects a candidate with a reason'
);

select ok(
  exists (
    select 1
    from public.audit_events
    where entity_type = 'content_candidates'
      and entity_id in (
        '52800000-0000-0000-0000-000000000001',
        '52800000-0000-0000-0000-000000000004'
      )
      and action in ('content_candidates.status.approved', 'content_candidates.status.rejected')
  ),
  'candidate decisions are written to the audit trail'
);

select lives_ok(
  $$ select public.link_organization_application_to_existing(
    '53800000-0000-0000-0000-000000000001',
    (
      select result_organization_id
      from public.content_candidates
      where id = '52800000-0000-0000-0000-000000000001'
    ),
    'Applicant identity verified'
  ) $$,
  'administrator links a submitted application to an ownerless imported organization'
);

select ok(
  exists (
    select 1
    from public.organization_members member_record
    join public.organization_applications application
      on application.organization_id = member_record.organization_id
    where application.id = '53800000-0000-0000-0000-000000000001'
      and member_record.user_id = '00000000-0000-0000-0000-000000000083'
      and member_record.role = 'owner'
      and member_record.is_active
  ),
  'linking creates an active owner membership without a duplicate organization'
);

select lives_ok(
  $$ select public.link_organization_application_to_existing(
    '53800000-0000-0000-0000-000000000001',
    (
      select result_organization_id
      from public.content_candidates
      where id = '52800000-0000-0000-0000-000000000001'
    ),
    'Applicant identity verified'
  ) $$,
  'repeated application linking is idempotent'
);

select is(
  public.normalize_import_organization_name('  АРТ-КЛАСТЕР «ТАВРИДА»  '),
  public.normalize_import_organization_name('Арт кластер Таврида'),
  'organization identity normalization is stable'
);

reset role;

insert into public.content_candidates (
  id, action, status, payload, evidence, warnings, source_url,
  content_hash, normalized_fingerprint
)
values (
  '52800000-0000-0000-0000-000000000013',
  'create_organization',
  'pending',
  jsonb_build_object(
    'kind', 'organization',
    'name', 'Canonical Import Organization',
    'typeSlug', 'ingestion-tests',
    'description', 'Canonical organization candidate description',
    'address', null,
    'phone', '+7 978 100-00-00',
    'workingHours', null,
    'contactLinks', '[]'::jsonb,
    'imageSourceUrl', null
  ),
  jsonb_build_array(jsonb_build_object(
    'field', 'name', 'excerpt', 'Canonical Import Organization',
    'sourceUrl', 'https://example.test/canonical-organization'
  )),
  '[]'::jsonb,
  'https://example.test/canonical-organization',
  'hash-canonical-organization',
  'fingerprint-canonical-organization'
);

select ok(
  pg_temp.statement_raises($$ insert into public.content_candidates (
    id, action, status, payload, evidence, warnings, source_url,
    content_hash, normalized_fingerprint
  ) values (
    '52800000-0000-0000-0000-000000000014',
    'create_organization',
    'pending',
    jsonb_build_object(
      'kind', 'organization', 'name', ' canonical-import organization ',
      'typeSlug', 'ingestion-tests', 'description', null, 'address', null,
      'phone', null, 'workingHours', null, 'contactLinks', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    '[]'::jsonb, '[]'::jsonb,
    'https://example.test/canonical-organization-copy',
    'hash-canonical-organization-copy',
    'fingerprint-canonical-organization-copy'
  ) $$),
  'only one pending organization candidate can use a normalized identity'
);

insert into public.content_candidates (
  id, action, status, payload, evidence, warnings, source_url,
  content_hash, normalized_fingerprint
)
values (
  '52800000-0000-0000-0000-000000000015',
  'create_organization',
  'pending',
  jsonb_build_object(
    'kind', 'organization',
    'name', 'Ingestion Existing Organization',
    'typeSlug', 'ingestion-tests',
    'description', 'Attempt to recreate an active organization',
    'address', null,
    'phone', '+7 978 200-00-00',
    'workingHours', null,
    'contactLinks', '[]'::jsonb,
    'imageSourceUrl', null
  ),
  jsonb_build_array(jsonb_build_object(
    'field', 'name', 'excerpt', 'Ingestion Existing Organization',
    'sourceUrl', 'https://example.test/existing-organization-copy'
  )),
  '[]'::jsonb,
  'https://example.test/existing-organization-copy',
  'hash-existing-organization-copy',
  'fingerprint-existing-organization-copy'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', true);

select ok(
  pg_temp.statement_raises($$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000015', 'approve_publish', null, null
  ) $$),
  'organization review rechecks active normalized names under its transaction lock'
);

reset role;

insert into public.content_candidates (
  id, action, status, payload, evidence, warnings, source_url,
  content_hash, normalized_fingerprint, target_organization_id
)
values
(
  '52800000-0000-0000-0000-000000000016',
  'create_publication',
  'pending',
  jsonb_build_object(
    'kind', 'publication',
    'organizationId', '41800000-0000-0000-0000-000000000001',
    'organizationName', 'Ingestion Existing Organization',
    'targetPublicationId', null,
    'type', 'event',
    'title', 'Already ended imported event',
    'description', 'Complete description of an imported event that already ended',
    'categorySlug', 'ingestion-tests',
    'startsAt', (now() - interval '2 days')::text,
    'endsAt', (now() - interval '1 day')::text,
    'validUntil', null,
    'sourcePublishedAt', (now() - interval '3 days')::text,
    'place', 'Sudak',
    'priceText', 'Free',
    'isFree', true,
    'ageLimit', null,
    'contactPhone', null,
    'scheduleEntries', '[]'::jsonb,
    'imageSourceUrl', null
  ),
  jsonb_build_array(jsonb_build_object(
    'field', 'dates', 'excerpt', 'Event already ended',
    'sourceUrl', 'https://example.test/ended-event'
  )),
  '[]'::jsonb,
  'https://example.test/ended-event',
  'hash-ended-event',
  'fingerprint-ended-event',
  '41800000-0000-0000-0000-000000000001'
),
(
  '52800000-0000-0000-0000-000000000017',
  'create_publication',
  'pending',
  jsonb_build_object(
    'kind', 'publication',
    'organizationId', '41800000-0000-0000-0000-000000000001',
    'organizationName', 'Ingestion Existing Organization',
    'targetPublicationId', null,
    'type', 'news',
    'title', 'Imported news without source date',
    'description', 'Complete imported news description without a reliable source date',
    'categorySlug', 'ingestion-tests',
    'startsAt', null,
    'endsAt', null,
    'validUntil', (now() + interval '7 days')::text,
    'sourcePublishedAt', null,
    'place', null,
    'priceText', null,
    'isFree', false,
    'ageLimit', null,
    'contactPhone', null,
    'scheduleEntries', '[]'::jsonb,
    'imageSourceUrl', null
  ),
  jsonb_build_array(jsonb_build_object(
    'field', 'title', 'excerpt', 'Imported news without source date',
    'sourceUrl', 'https://example.test/undated-news'
  )),
  '[]'::jsonb,
  'https://example.test/undated-news',
  'hash-undated-news',
  'fingerprint-undated-news',
  '41800000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', true);

select ok(
  pg_temp.statement_raises($$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000016', 'approve_publish', null, null
  ) $$),
  'SQL review rejects an imported event whose end is not in the future'
);

select ok(
  pg_temp.statement_raises($$ select public.review_content_candidate(
    '52800000-0000-0000-0000-000000000017', 'approve_publish', null, null
  ) $$),
  'SQL review rejects imported news without a reliable source publication date'
);

reset role;

update public.content_sources
set next_check_at = case
  when id = '50800000-0000-0000-0000-000000000001' then now() - interval '1 minute'
  else now() + interval '1 day'
end;

select ok(
  has_function_privilege('service_role', 'public.claim_due_content_sources(integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.claim_due_content_sources(integer)', 'EXECUTE'),
  'only service_role can execute the due-source claim RPC'
);

select is(
  (
    select count(*)
    from public.claim_due_content_sources(5)
    where id = '50800000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'due-source claim returns the active due source once'
);

select * from finish();

rollback;
