begin;

set search_path = public, extensions;

select plan(14);

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
  ('00000000-0000-0000-0000-000000000030', 'media-owner@example.test'),
  ('00000000-0000-0000-0000-000000000031', 'media-manager@example.test'),
  ('00000000-0000-0000-0000-000000000032', 'media-outsider@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000030', 'user', 'Media Owner'),
  ('00000000-0000-0000-0000-000000000031', 'user', 'Media Manager'),
  ('00000000-0000-0000-0000-000000000032', 'user', 'Media Outsider')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

insert into public.organization_types (id, slug, name, sort_order)
values ('30200000-0000-0000-0000-000000000001', 'media-tests', 'Media Tests', 999)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.publication_categories (id, slug, name, sort_order)
values ('31200000-0000-0000-0000-000000000001', 'media-tests', 'Media Tests', 999)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.organizations (
  id, slug, name, description, phone, status, type_id, created_by
)
values
  (
    '21200000-0000-0000-0000-000000000001',
    'media-tests-own',
    'Media Tests Own',
    'Organization for media workflow tests',
    '+7 900 000-00-30',
    'active',
    (select id from public.organization_types where slug = 'media-tests'),
    '00000000-0000-0000-0000-000000000030'
  ),
  (
    '21200000-0000-0000-0000-000000000002',
    'media-tests-foreign',
    'Media Tests Foreign',
    'Foreign organization for media workflow tests',
    '+7 900 000-00-32',
    'active',
    (select id from public.organization_types where slug = 'media-tests'),
    '00000000-0000-0000-0000-000000000032'
  );

insert into public.organization_members (organization_id, user_id, role, is_active)
values
  ('21200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', 'owner', true),
  ('21200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', 'manager', true),
  ('21200000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000032', 'owner', true);

insert into public.publications (
  id,
  slug,
  organization_id,
  author_id,
  type,
  title,
  description,
  category_id,
  status,
  valid_until,
  is_free
)
values
  (
    '22200000-0000-0000-0000-000000000001',
    'media-tests-own-publication',
    '21200000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000030',
    'news',
    'Own media publication',
    'Complete publication description for media tests',
    (select id from public.publication_categories where slug = 'media-tests'),
    'draft',
    now() + interval '2 days',
    false
  ),
  (
    '22200000-0000-0000-0000-000000000002',
    'media-tests-foreign-publication',
    '21200000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000032',
    'news',
    'Foreign media publication',
    'Complete foreign publication description for media tests',
    (select id from public.publication_categories where slug = 'media-tests'),
    'draft',
    now() + interval '2 days',
    false
  );

insert into public.media_assets (
  id,
  bucket_id,
  storage_path,
  purpose,
  visibility,
  organization_id,
  uploaded_by
)
values
  (
    '23200000-0000-0000-0000-000000000001',
    'organization-images',
    'organizations/21200000-0000-0000-0000-000000000001/original.png',
    'organization_logo',
    'public',
    '21200000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000030'
  ),
  (
    '23200000-0000-0000-0000-000000000003',
    'organization-images',
    'organizations/21200000-0000-0000-0000-000000000001/untouched.png',
    'organization_cover',
    'public',
    '21200000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000030'
  );

insert into storage.objects (id, bucket_id, name, owner)
values
  (
    '24200000-0000-0000-0000-000000000001',
    'organization-images',
    'organizations/21200000-0000-0000-0000-000000000001/orphan.png',
    '00000000-0000-0000-0000-000000000031'
  ),
  (
    '24200000-0000-0000-0000-000000000002',
    'publication-images',
    'publications/22200000-0000-0000-0000-000000000001/orphan.png',
    '00000000-0000-0000-0000-000000000031'
  ),
  (
    '24200000-0000-0000-0000-000000000003',
    'organization-images',
    'organizations/21200000-0000-0000-0000-000000000002/orphan.png',
    '00000000-0000-0000-0000-000000000032'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)
    from public.media_assets
    where id = '23200000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'manager reads an active asset uploaded by another representative'
);

update public.media_assets
set deleted_at = now()
where id = '23200000-0000-0000-0000-000000000001';

select ok(
  (
    select deleted_at is not null
    from public.media_assets
    where id = '23200000-0000-0000-0000-000000000001'
  ),
  'manager soft-deletes an asset uploaded by another representative'
);

select is(
  (
    select count(*)
    from public.media_assets
    where id = '23200000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'manager can read a manageable soft-deleted asset during replacement cleanup'
);

insert into public.media_assets (
  id,
  bucket_id,
  storage_path,
  purpose,
  visibility,
  organization_id
)
values (
  '23200000-0000-0000-0000-000000000002',
  'organization-images',
  'organizations/21200000-0000-0000-0000-000000000001/replacement.png',
  'organization_logo',
  'public',
  '21200000-0000-0000-0000-000000000001'
);

select is(
  (
    select uploaded_by
    from public.media_assets
    where id = '23200000-0000-0000-0000-000000000002'
  ),
  '00000000-0000-0000-0000-000000000031'::uuid,
  'replacement asset derives uploaded_by from auth context'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.media_assets (
         bucket_id, storage_path, purpose, visibility, organization_id, uploaded_by
       )
       values (
         'organization-images',
         'organizations/21200000-0000-0000-0000-000000000001/forged.png',
         'organization_logo',
         'public',
         '21200000-0000-0000-0000-000000000001',
         '00000000-0000-0000-0000-000000000030'
       ) $$
  ),
  'manager cannot forge uploaded_by for a new asset'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.media_assets (
         bucket_id, storage_path, purpose, visibility, publication_id
       )
       values (
         'publication-images',
         'publications/22200000-0000-0000-0000-000000000002/foreign.png',
         'publication_photo',
         'public',
         '22200000-0000-0000-0000-000000000002'
       ) $$
  ),
  'manager cannot attach an asset to a foreign publication'
);

select is(
  (
    select count(*)
    from storage.objects
    where id = '24200000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'manager can read an orphan object under their organization path for cleanup'
);

select is(
  (
    select count(*)
    from storage.objects
    where id = '24200000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'manager can read an orphan object under their publication path for cleanup'
);

select is(
  (
    select count(*)
    from storage.objects
    where id = '24200000-0000-0000-0000-000000000003'
  ),
  0::bigint,
  'manager cannot read an orphan object under a foreign organization path'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', true);

update public.media_assets
set deleted_at = now()
where id = '23200000-0000-0000-0000-000000000003';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);

select ok(
  (
    select deleted_at is null
    from public.media_assets
    where id = '23200000-0000-0000-0000-000000000003'
  ),
  'outsider cannot soft-delete another organization asset'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', true);

select is(
  (
    select count(*)
    from storage.objects
    where id in (
      '24200000-0000-0000-0000-000000000001',
      '24200000-0000-0000-0000-000000000002'
    )
  ),
  0::bigint,
  'outsider cannot read orphan objects under another organization paths'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'media_assets'
      and policyname = 'Authenticated users can update allowed media assets'
  ),
  'media asset update policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Members and admins can delete linked media storage objects'
  ),
  'storage cleanup delete policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Members and admins can read manageable media storage objects'
  ),
  'storage cleanup select policy exists'
);

select * from finish();

rollback;
