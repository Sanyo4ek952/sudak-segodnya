begin;

set search_path = public, extensions;

select plan(24);

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
  ('00000000-0000-0000-0000-000000000093', 'vk-user@example.test'),
  ('00000000-0000-0000-0000-000000000094', 'vk-admin@example.test')
on conflict (id) do update set email = excluded.email;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000093', 'user', 'VK User'),
  ('00000000-0000-0000-0000-000000000094', 'admin', 'VK Admin')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

insert into public.organization_types (id, slug, name, sort_order)
values ('30900000-0000-0000-0000-000000000001', 'vk-import-tests', 'VK Import Tests', 998)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.publication_categories (id, slug, name, sort_order)
values ('31900000-0000-0000-0000-000000000001', 'vk-import-tests', 'VK Import Tests', 998)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.organizations (
  id, slug, name, description, phone, status, type_id, created_by, last_public_update_at
)
values (
  '41900000-0000-0000-0000-000000000001',
  'vk-import-test-organization',
  'VK Import Test Organization',
  'Active organization for VK import regression tests',
  '+7 900 000-09-01',
  'active',
  '30900000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000094',
  now()
);

insert into public.external_sources (
  id, platform, external_id, domain, name, url, organization_id, is_active, created_by
)
values (
  '50900000-0000-0000-0000-000000000001',
  'vk',
  '-9001',
  'vk_import_fixture',
  'VK Import Fixture',
  'https://vk.com/vk_import_fixture',
  '41900000-0000-0000-0000-000000000001',
  true,
  '00000000-0000-0000-0000-000000000094'
);

insert into public.external_items (
  id, source_id, external_id, source_url, text, published_at, media, raw_payload
)
values
  (
    '51900000-0000-0000-0000-000000000001',
    '50900000-0000-0000-0000-000000000001',
    '501',
    'https://vk.com/wall-9001_501',
    E'Новая публикация VK\nПодробное описание для проверки администратором.',
    now(),
    jsonb_build_array(jsonb_build_object(
      'type', 'photo',
      'sourceUrl', 'https://sun.example.test/vk-import.jpg',
      'width', 1280,
      'height', 960,
      'externalId', '-9001_7001'
    )),
    jsonb_build_object('id', 501, 'owner_id', -9001, 'date', extract(epoch from now())::integer)
  ),
  (
    '51900000-0000-0000-0000-000000000002',
    '50900000-0000-0000-0000-000000000001',
    '502',
    'https://vk.com/wall-9001_502',
    'Материал для игнорирования',
    now(),
    '[]'::jsonb,
    jsonb_build_object('id', 502, 'owner_id', -9001, 'date', extract(epoch from now())::integer)
  );

insert into public.external_items (
  source_id, external_id, source_url, text, published_at, media, raw_payload
)
values (
  '50900000-0000-0000-0000-000000000001',
  '501',
  'https://vk.com/wall-9001_501',
  'Повторный ответ VK API',
  now(),
  '[]'::jsonb,
  jsonb_build_object('id', 501, 'owner_id', -9001)
)
on conflict (source_id, external_id) do nothing;

select is(
  (select count(*) from public.external_items where source_id = '50900000-0000-0000-0000-000000000001' and external_id = '501'),
  1::bigint,
  'database deduplication keeps one VK post per source'
);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

select ok(
  pg_temp.statement_raises('select count(*) from public.external_sources'),
  'anonymous users cannot read VK sources'
);

select ok(
  pg_temp.statement_raises('select count(*) from public.external_items'),
  'anonymous users cannot read the VK queue'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000093', true);

select is(
  (select count(*) from public.external_sources where id = '50900000-0000-0000-0000-000000000001'),
  0::bigint,
  'ordinary authenticated users see no VK sources through RLS'
);

select is(
  (select count(*) from public.external_items where source_id = '50900000-0000-0000-0000-000000000001'),
  0::bigint,
  'ordinary authenticated users see no VK queue items through RLS'
);

select ok(
  pg_temp.statement_raises($$ select public.prepare_vk_external_item_for_review(
    '51900000-0000-0000-0000-000000000001'
  ) $$),
  'non-admin cannot prepare a VK item for publication review'
);

select ok(
  pg_temp.statement_raises($$ select public.ignore_vk_external_item(
    '51900000-0000-0000-0000-000000000002'
  ) $$),
  'non-admin cannot ignore a VK item'
);

select ok(
  pg_temp.statement_raises($$ insert into public.external_sources (
    platform, domain, name, url, created_by
  ) values (
    'vk', 'forbidden_vk_source', 'Forbidden VK Source',
    'https://vk.com/forbidden_vk_source',
    '00000000-0000-0000-0000-000000000093'
  ) $$),
  'non-admin cannot add a VK source'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000094', true);

select is(
  (select count(*) from public.external_sources where id = '50900000-0000-0000-0000-000000000001'),
  1::bigint,
  'administrator can read VK sources'
);

select lives_ok(
  $$ insert into public.external_sources (
    platform, domain, name, url, is_active, created_by
  ) values (
    'vk', 'second_vk_fixture', 'Second VK Fixture',
    'https://vk.com/second_vk_fixture', false,
    '00000000-0000-0000-0000-000000000094'
  ) $$,
  'administrator can add a VK source'
);

select ok(
  pg_temp.statement_raises($$ insert into public.external_sources (
    platform, domain, name, url, is_active, created_by
  ) values (
    'vk', 'VK_IMPORT_FIXTURE', 'Duplicate VK Fixture',
    'https://vk.com/VK_IMPORT_FIXTURE', false,
    '00000000-0000-0000-0000-000000000094'
  ) $$),
  'source domain uniqueness is case-insensitive'
);

select isnt(
  public.prepare_vk_external_item_for_review('51900000-0000-0000-0000-000000000001'),
  null::uuid,
  'administrator can prepare a new VK item'
);

select isnt(
  (select content_candidate_id from public.external_items where id = '51900000-0000-0000-0000-000000000001'),
  null::uuid,
  'prepared VK item is linked to the existing content candidate workflow'
);

select is(
  public.prepare_vk_external_item_for_review('51900000-0000-0000-0000-000000000001'),
  (select content_candidate_id from public.external_items where id = '51900000-0000-0000-0000-000000000001'),
  'repeated preparation is idempotent'
);

select is(
  (
    select count(*)
    from public.content_candidates candidate
    join public.external_items item on item.content_candidate_id = candidate.id
    where item.id = '51900000-0000-0000-0000-000000000001'
      and candidate.action = 'create_publication'
      and candidate.status = 'pending'
      and candidate.source_url = item.source_url
  ),
  1::bigint,
  'VK prefill creates one private publication candidate with provenance'
);

select is(
  public.ignore_vk_external_item('51900000-0000-0000-0000-000000000002'),
  '51900000-0000-0000-0000-000000000002'::uuid,
  'administrator can ignore a new VK item'
);

select is(
  (select status::text from public.external_items where id = '51900000-0000-0000-0000-000000000002'),
  'ignored',
  'ignored VK item keeps an explicit terminal status'
);

select ok(
  pg_temp.statement_raises($$ select public.prepare_vk_external_item_for_review(
    '51900000-0000-0000-0000-000000000002'
  ) $$),
  'ignored VK item cannot be prepared accidentally'
);

select isnt(
  (
    public.review_content_candidate(
      (select content_candidate_id from public.external_items where id = '51900000-0000-0000-0000-000000000001'),
      'approve_draft',
      null,
      null
    ) ->> 'publication_id'
  ),
  null::text,
  'existing guarded review flow creates a draft publication from VK prefill'
);

select is(
  (select status::text from public.external_items where id = '51900000-0000-0000-0000-000000000001'),
  'imported',
  'publication creation atomically marks the VK item imported'
);

select isnt(
  (select publication_id from public.external_items where id = '51900000-0000-0000-0000-000000000001'),
  null::uuid,
  'imported VK item stores its publication provenance'
);

select ok(
  pg_temp.statement_raises($$ select public.prepare_vk_external_item_for_review(
    '51900000-0000-0000-0000-000000000001'
  ) $$),
  'imported VK item cannot start another publication flow'
);

select ok(
  (
    public.review_content_candidate(
      (select content_candidate_id from public.external_items where id = '51900000-0000-0000-0000-000000000001'),
      'approve_draft',
      null,
      null
    ) ->> 'idempotent'
  )::boolean,
  'repeating the final review returns the existing result'
);

select is(
  (
    select count(*)
    from public.publications publication
    where publication.id = (
      select publication_id
      from public.external_items
      where id = '51900000-0000-0000-0000-000000000001'
    )
  ),
  1::bigint,
  'an imported VK item is linked to exactly one publication'
);

select * from finish();

rollback;
