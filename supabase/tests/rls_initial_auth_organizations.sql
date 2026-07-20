begin;

set search_path = public, extensions;

select plan(21);

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
  ('00000000-0000-0000-0000-000000000001', 'user-one@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'user-two@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'admin@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'auto-profile@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000001', 'user', 'User One'),
  ('00000000-0000-0000-0000-000000000002', 'user', 'User Two'),
  ('00000000-0000-0000-0000-000000000003', 'admin', 'Admin')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

select ok(
  (
    select role = 'user'
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000004'
  ),
  'auth user trigger creates a user profile'
);

insert into public.organization_categories (id, slug, name, sort_order)
values
  ('30000000-0000-0000-0000-000000000001', 'food', 'Food', 10),
  ('30000000-0000-0000-0000-000000000008', 'services', 'Services', 80)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;

insert into public.organizations (id, slug, name, status, category_id, created_by)
values
  ('10000000-0000-0000-0000-000000000001', 'active-org', 'Active Org', 'active', '30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000002', 'pending-org', 'Pending Org', 'pending', '30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003', 'member-org', 'Member Org', 'pending', '30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003');

insert into public.organization_members (organization_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'manager');

insert into public.organization_applications (
  id,
  applicant_id,
  status,
  organization_name,
  category_id,
  description,
  address,
  phone,
  relationship
)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'draft', 'User One App', '30000000-0000-0000-0000-000000000008', 'Description', 'Address', 'Phone', 'Owner'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'draft', 'User Two App', '30000000-0000-0000-0000-000000000008', 'Description', 'Address', 'Phone', 'Owner'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'needs_changes', 'Needs Changes App', '30000000-0000-0000-0000-000000000008', 'Description', 'Address', 'Phone', 'Owner'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'rejected', 'Rejected App', '30000000-0000-0000-0000-000000000008', 'Description', 'Address', 'Phone', 'Owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'user reads only their profile'
);

select is(
  (select id from public.profiles),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'user does not read another user profile'
);

select ok(
  pg_temp.statement_raises(
    $$ update public.profiles
       set role = 'admin'
       where id = '00000000-0000-0000-0000-000000000001' $$
  ),
  'user cannot change profile system role'
);

select ok(
  pg_temp.statement_raises(
    $$ update public.profiles
       set id = '00000000-0000-0000-0000-000000000002'
       where id = '00000000-0000-0000-0000-000000000001' $$
  ),
  'user cannot replace profile id'
);

select ok(
  not pg_temp.statement_raises(
    $$ insert into public.organization_applications (
         applicant_id,
         organization_name,
         category_id,
         description,
         address,
         phone,
         relationship
       )
       values (
         '00000000-0000-0000-0000-000000000001',
         'User One New App',
         '30000000-0000-0000-0000-000000000008',
         'Description',
         'Address',
         'Phone',
         'Owner'
       ) $$
  ),
  'authenticated user creates their own organization application'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.organization_applications (applicant_id, organization_name)
       values ('00000000-0000-0000-0000-000000000002', 'Forged App') $$
  ),
  'user cannot forge application applicant_id'
);

select ok(
  not exists (
    select 1
    from public.organization_applications
    where id = '20000000-0000-0000-0000-000000000002'
  ),
  'user does not read another user application'
);

select ok(
  pg_temp.statement_raises(
    $$ update public.organization_applications
       set status = 'approved'
       where id = '20000000-0000-0000-0000-000000000001' $$
  ),
  'user cannot change application system status'
);

select ok(
  not pg_temp.statement_raises(
    $$ update public.organization_applications
       set description = 'Updated by applicant'
       where id = '20000000-0000-0000-0000-000000000001' $$
  ),
  'user can edit their application in an allowed status'
);

select ok(
  pg_temp.statement_raises(
    $$ update public.organization_applications
       set description = 'Rejected edit'
       where id = '20000000-0000-0000-0000-000000000004' $$
  ),
  'user cannot edit an application in a disallowed status'
);

select ok(
  pg_temp.statement_raises(
    $$ update public.organization_applications
       set status = 'submitted'
       where id = '20000000-0000-0000-0000-000000000003' $$
  ),
  'user cannot move needs_changes to submitted by direct update'
);

select is(
  (select (public.submit_organization_application('20000000-0000-0000-0000-000000000003')).status),
  'submitted'::public.organization_application_status,
  'user can resubmit needs_changes application through the provided operation'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.organization_applications (
         applicant_id,
         organization_name,
         category_id,
         description,
         address,
         phone,
         relationship
       )
       values (
         '00000000-0000-0000-0000-000000000001',
         'User One App',
         '30000000-0000-0000-0000-000000000008',
         'Duplicate',
         'Address',
         'Phone',
         'Owner'
       ) $$
  ),
  'user cannot create a duplicate active application for the same organization name'
);

select is(
  (
    select count(*)
    from public.organization_applications
    where applicant_id = '00000000-0000-0000-0000-000000000001'
      and lower(btrim(organization_name)) = 'user one app'
  ),
  1::bigint,
  'duplicate application restriction leaves only the original active application'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.organization_members (organization_id, user_id, role)
       values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'manager') $$
  ),
  'user cannot add themselves to another organization'
);

select ok(
  pg_temp.statement_raises(
    $$ insert into public.organization_members (organization_id, user_id, role)
       values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'manager') $$
  ),
  'direct membership creation is forbidden for non-admin users'
);

update public.organization_members
set role = 'owner'
where organization_id = '10000000-0000-0000-0000-000000000003'
  and user_id = '00000000-0000-0000-0000-000000000001';

select is(
  (
    select role
    from public.organization_members
    where organization_id = '10000000-0000-0000-0000-000000000003'
      and user_id = '00000000-0000-0000-0000-000000000001'
  ),
  'manager'::public.organization_member_role,
  'representative cannot promote their own membership role'
);

update public.organizations
set status = 'active'
where id = '10000000-0000-0000-0000-000000000003';

select is(
  (
    select status
    from public.organizations
    where id = '10000000-0000-0000-0000-000000000003'
  ),
  'pending'::public.organization_status,
  'representative cannot change organization system status'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select is(
  (
    select array_agg(slug order by slug)
    from public.organizations
  ),
  array['active-org'::text],
  'public user sees only active organizations'
);

select ok(
  (
    select array_agg(slug order by slug) @> array['food'::text, 'services'::text]
    from public.organization_categories
  ),
  'public user sees active organization categories'
);

select * from finish();

rollback;
