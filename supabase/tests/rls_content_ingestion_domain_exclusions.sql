begin;

set search_path = public, extensions;

select plan(18);

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
  ('00000000-0000-0000-0000-000000000091', 'domain-user@example.test'),
  ('00000000-0000-0000-0000-000000000092', 'domain-admin@example.test')
on conflict (id) do update set email = excluded.email;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000091', 'user', 'Domain User'),
  ('00000000-0000-0000-0000-000000000092', 'admin', 'Domain Admin')
on conflict (id) do update set role = excluded.role, display_name = excluded.display_name;

insert into public.organization_types (id, slug, name, sort_order)
values ('30800000-0000-0000-0000-000000000091', 'domain-tests', 'Domain Tests', 996)
on conflict (slug) do update set name = excluded.name, is_active = true;

insert into public.publication_categories (id, slug, name, sort_order)
values ('31800000-0000-0000-0000-000000000091', 'domain-tests', 'Domain Tests', 996)
on conflict (slug) do update set name = excluded.name, is_active = true;

insert into public.content_sources (
  id, name, kind, url, canonical_url, trust_level, is_active,
  fetch_interval_minutes, next_check_at, created_by
)
values (
  '50800000-0000-0000-0000-000000000091',
  'Excluded domain fixture',
  'html',
  'https://news.blocked-example.test/sudak',
  'https://news.blocked-example.test/sudak',
  'official',
  true,
  1440,
  now() - interval '1 minute',
  '00000000-0000-0000-0000-000000000092'
);

insert into public.content_candidates (
  id, action, status, payload, evidence, warnings, source_url,
  source_checked_at, content_hash, normalized_fingerprint, depends_on_candidate_id
)
values
  (
    '52800000-0000-0000-0000-000000000091',
    'create_organization',
    'pending',
    jsonb_build_object(
      'kind', 'organization',
      'name', 'Atomic Imported Organization',
      'typeSlug', 'domain-tests',
      'description', 'Complete organization description for atomic review',
      'address', 'Sudak',
      'phone', '+7 900 000-09-01',
      'workingHours', null,
      'contactLinks', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    jsonb_build_array(jsonb_build_object(
      'field', 'organization',
      'excerpt', 'Atomic Imported Organization',
      'sourceUrl', 'https://allowed-example.test/event'
    )),
    '[]'::jsonb,
    'https://allowed-example.test/event',
    now(),
    'atomic-org-hash',
    'atomic-org-fingerprint',
    null
  ),
  (
    '52800000-0000-0000-0000-000000000092',
    'create_publication',
    'pending',
    jsonb_build_object(
      'kind', 'publication',
      'organizationId', null,
      'organizationName', 'Atomic Imported Organization',
      'targetPublicationId', null,
      'type', 'event',
      'title', 'Atomic imported event',
      'description', 'Complete description for the atomic imported event',
      'categorySlug', 'domain-tests',
      'startsAt', (now() + interval '10 days')::text,
      'endsAt', (now() + interval '10 days 2 hours')::text,
      'validUntil', null,
      'place', 'Sudak library',
      'priceText', 'Бесплатно',
      'isFree', true,
      'ageLimit', null,
      'contactPhone', '+7 900 000-09-01',
      'scheduleEntries', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    jsonb_build_array(jsonb_build_object(
      'field', 'title',
      'excerpt', 'Atomic imported event',
      'sourceUrl', 'https://allowed-example.test/event'
    )),
    '[]'::jsonb,
    'https://allowed-example.test/event',
    now(),
    'atomic-publication-hash',
    'atomic-publication-fingerprint',
    '52800000-0000-0000-0000-000000000091'
  ),
  (
    '52800000-0000-0000-0000-000000000093',
    'create_organization',
    'pending',
    jsonb_build_object(
      'kind', 'organization',
      'name', 'Rollback Imported Organization',
      'typeSlug', 'domain-tests',
      'description', 'Complete organization description for rollback review',
      'address', 'Sudak',
      'phone', '+7 900 000-09-02',
      'workingHours', null,
      'contactLinks', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    jsonb_build_array(jsonb_build_object(
      'field', 'organization',
      'excerpt', 'Rollback Imported Organization',
      'sourceUrl', 'https://allowed-example.test/invalid'
    )),
    '[]'::jsonb,
    'https://allowed-example.test/invalid',
    now(),
    'rollback-org-hash',
    'rollback-org-fingerprint',
    null
  ),
  (
    '52800000-0000-0000-0000-000000000094',
    'create_publication',
    'pending',
    jsonb_build_object(
      'kind', 'publication',
      'organizationId', null,
      'organizationName', 'Rollback Imported Organization',
      'targetPublicationId', null,
      'type', 'news',
      'title', 'Invalid atomic publication',
      'description', null,
      'categorySlug', 'domain-tests',
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
    jsonb_build_array(jsonb_build_object(
      'field', 'title',
      'excerpt', 'Invalid atomic publication',
      'sourceUrl', 'https://allowed-example.test/invalid'
    )),
    '[]'::jsonb,
    'https://allowed-example.test/invalid',
    now(),
    'rollback-publication-hash',
    'rollback-publication-fingerprint',
    '52800000-0000-0000-0000-000000000093'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000091', true);

select is(
  (select count(*) from public.content_ingestion_domain_exclusions),
  0::bigint,
  'ordinary users cannot read excluded domains'
);

select ok(
  pg_temp.statement_raises($$ insert into public.content_ingestion_domain_exclusions (domain, created_by)
    values ('blocked-example.test', '00000000-0000-0000-0000-000000000091') $$),
  'ordinary users cannot add excluded domains'
);

select ok(
  pg_temp.statement_raises($$ select public.review_content_candidate_with_organization(
    '52800000-0000-0000-0000-000000000092',
    'approve_publish',
    (select payload from public.content_candidates where id = '52800000-0000-0000-0000-000000000092'),
    '52800000-0000-0000-0000-000000000091',
    (select payload from public.content_candidates where id = '52800000-0000-0000-0000-000000000091'),
    null
  ) $$),
  'ordinary users cannot run combined candidate review'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000092', true);

select lives_ok(
  $$ insert into public.content_ingestion_domain_exclusions (domain, created_by)
    values ('blocked-example.test', '00000000-0000-0000-0000-000000000092') $$,
  'administrator can exclude a domain'
);

select is(
  (select count(*) from public.content_ingestion_domain_exclusions where domain = 'blocked-example.test'),
  1::bigint,
  'administrator can read the excluded domain'
);

reset role;

select ok(
  pg_temp.statement_raises($$ insert into public.content_sources (
    name, kind, url, canonical_url, trust_level, is_active
  ) values (
    'Blocked source', 'html', 'https://blocked-example.test/new',
    'https://blocked-example.test/new', 'official', true
  ) $$),
  'database rejects a newly configured source from an excluded domain'
);

select ok(
  pg_temp.statement_raises($$ insert into public.content_candidates (
    action, status, payload, evidence, warnings, source_url,
    source_checked_at, content_hash, normalized_fingerprint
  ) values (
    'create_organization',
    'pending',
    jsonb_build_object(
      'kind', 'organization',
      'name', 'Blocked candidate',
      'typeSlug', 'domain-tests',
      'description', 'Blocked candidate description',
      'address', null,
      'phone', '+7 900 000-09-03',
      'workingHours', null,
      'contactLinks', '[]'::jsonb,
      'imageSourceUrl', null
    ),
    jsonb_build_array(jsonb_build_object(
      'field', 'organization',
      'excerpt', 'Blocked candidate',
      'sourceUrl', 'https://events.blocked-example.test/new'
    )),
    '[]'::jsonb,
    'https://events.blocked-example.test/new',
    now(),
    'blocked-candidate-hash',
    'blocked-candidate-fingerprint'
  ) $$),
  'database rejects a candidate from an excluded subdomain'
);

select is(
  (select count(*) from public.claim_due_content_sources(5)
    where id = '50800000-0000-0000-0000-000000000091'),
  0::bigint,
  'due-source claim skips an excluded subdomain'
);

select is(
  (select count(*) from public.content_sources where id = '50800000-0000-0000-0000-000000000091'),
  1::bigint,
  'excluding a domain does not delete its configured source'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000092', true);

select lives_ok(
  $$ delete from public.content_ingestion_domain_exclusions where domain = 'blocked-example.test' $$,
  'administrator can allow an excluded domain again'
);

reset role;

select is(
  (select count(*) from public.content_sources where id = '50800000-0000-0000-0000-000000000091'),
  1::bigint,
  'removing an exclusion leaves existing source data intact'
);

select is(
  (select count(*) from public.claim_due_content_sources(5)
    where id = '50800000-0000-0000-0000-000000000091'),
  1::bigint,
  'source becomes claimable after its exclusion is removed'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000092', true);

select lives_ok(
  $$ select public.review_content_candidate_with_organization(
    '52800000-0000-0000-0000-000000000092',
    'approve_publish',
    (select payload from public.content_candidates where id = '52800000-0000-0000-0000-000000000092'),
    '52800000-0000-0000-0000-000000000091',
    (select payload from public.content_candidates where id = '52800000-0000-0000-0000-000000000091'),
    'Reviewed together'
  ) $$,
  'administrator atomically creates the organization and publication'
);

select is(
  (select status::text from public.content_candidates where id = '52800000-0000-0000-0000-000000000091'),
  'approved',
  'combined review approves the organization candidate'
);

select ok(
  exists (
    select 1
    from public.content_candidates publication_candidate
    join public.publications publication
      on publication.id = publication_candidate.result_publication_id
    join public.content_candidates organization_candidate
      on organization_candidate.id = publication_candidate.depends_on_candidate_id
     and organization_candidate.result_organization_id = publication.organization_id
    where publication_candidate.id = '52800000-0000-0000-0000-000000000092'
      and publication_candidate.status = 'approved'
      and publication.status = 'published'
      and publication_candidate.payload ->> 'organizationId' = publication.organization_id::text
  ),
  'combined review links the published material to the newly created organization'
);

select ok(
  pg_temp.statement_raises($$ select public.review_content_candidate_with_organization(
    '52800000-0000-0000-0000-000000000094',
    'approve_publish',
    (select payload from public.content_candidates where id = '52800000-0000-0000-0000-000000000094'),
    '52800000-0000-0000-0000-000000000093',
    (select payload from public.content_candidates where id = '52800000-0000-0000-0000-000000000093'),
    null
  ) $$),
  'invalid publication rolls back combined review'
);

select ok(
  (select status = 'pending' and result_organization_id is null
    from public.content_candidates where id = '52800000-0000-0000-0000-000000000093')
  and
  (select status = 'pending' and result_publication_id is null
    from public.content_candidates where id = '52800000-0000-0000-0000-000000000094'),
  'failed combined review leaves both candidates untouched'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.review_content_candidate_with_organization(uuid, public.content_candidate_decision, jsonb, uuid, jsonb, text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.review_content_candidate_with_organization(uuid, public.content_candidate_decision, jsonb, uuid, jsonb, text)',
    'EXECUTE'
  ),
  'only authenticated administrators can reach the combined review RPC'
);

select * from finish();

rollback;
