begin;

set search_path = public, extensions;

select plan(43);

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
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
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
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'rejected', 'Rejected App', '30000000-0000-0000-0000-000000000008', 'Description', 'Address', 'Phone', 'Owner'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'submitted', 'Changes Review App', '30000000-0000-0000-0000-000000000008', 'Description', 'Address', 'Phone', 'Owner'),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'submitted', 'Approve Review App', '30000000-0000-0000-0000-000000000008', 'Description', 'Address', 'Phone', 'Owner'),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'submitted', 'Forbidden Transition App', '30000000-0000-0000-0000-000000000008', 'Description', 'Address', 'Phone', 'Owner');

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

select is(
  (
    select count(*)
    from public.organization_applications
    where status = 'submitted'
  ),
  1::bigint,
  'regular user does not read the full administrative submitted applications list'
);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.approve_organization_application('20000000-0000-0000-0000-000000000006') $$
  ),
  'regular user cannot call approve application rpc'
);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.request_organization_application_changes(
         '20000000-0000-0000-0000-000000000006',
         'Need more details'
       ) $$
  ),
  'regular user cannot call request changes application rpc'
);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.reject_organization_application(
         '20000000-0000-0000-0000-000000000006',
         'Rejected'
       ) $$
  ),
  'regular user cannot call reject application rpc'
);

select ok(
  pg_temp.statement_raises(
    $$ update public.organization_applications
       set reviewed_by = '00000000-0000-0000-0000-000000000001',
           reviewed_at = now(),
           admin_comment = 'Forged review'
       where id = '20000000-0000-0000-0000-000000000001' $$
  ),
  'regular user cannot forge review fields'
);

select is(
  (
    select (public.update_member_organization_profile(
      '10000000-0000-0000-0000-000000000001',
      'Updated Active Org',
      'Updated organization description',
      'Updated address',
      'Updated phone',
      'Daily'
    )).name
  ),
  'Updated Active Org'::text,
  'member can update their active organization profile through the provided operation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.update_member_organization_profile(
         '10000000-0000-0000-0000-000000000001',
         'Forged Active Org',
         'Forged description',
         'Forged address',
         'Forged phone',
         'Daily'
       ) $$
  ),
  'non-member cannot update another organization profile through rpc'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)
    from public.organization_applications
    where status = 'submitted'
  ),
  4::bigint,
  'admin reads the full submitted applications list'
);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.request_organization_application_changes(
         '20000000-0000-0000-0000-000000000005',
         '   '
       ) $$
  ),
  'request changes requires admin comment'
);

select is(
  (
    select public.request_organization_application_changes(
      '20000000-0000-0000-0000-000000000005',
      'Уточните подтверждающую информацию'
    )->>'status'
  ),
  'needs_changes'::text,
  'admin can request changes for submitted application'
);

select is(
  (
    select admin_comment
    from public.organization_applications
    where id = '20000000-0000-0000-0000-000000000005'
  ),
  'Уточните подтверждающую информацию'::text,
  'request changes stores admin comment'
);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.approve_organization_application('20000000-0000-0000-0000-000000000005') $$
  ),
  'needs_changes application cannot be approved'
);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.reject_organization_application(
         '20000000-0000-0000-0000-000000000005',
         ''
       ) $$
  ),
  'rejection requires admin comment'
);

select is(
  (
    select public.reject_organization_application(
      '20000000-0000-0000-0000-000000000005',
      'Не подтверждена связь с организацией'
    )->>'status'
  ),
  'rejected'::text,
  'admin can reject needs_changes application'
);

select is(
  (
    select count(*)
    from public.organizations
    where name = 'Changes Review App'
  ),
  0::bigint,
  'rejection does not create organization'
);

select is(
  (
    select public.approve_organization_application('20000000-0000-0000-0000-000000000006')->>'status'
  ),
  'approved'::text,
  'admin can approve submitted application'
);

select is(
  (
    select count(*)
    from public.organizations
    where id = (
      select organization_id
      from public.organization_applications
      where id = '20000000-0000-0000-0000-000000000006'
    )
  ),
  1::bigint,
  'approval creates exactly one organization'
);

select is(
  (
    select count(*)
    from public.organization_members
    where organization_id = (
      select organization_id
      from public.organization_applications
      where id = '20000000-0000-0000-0000-000000000006'
    )
      and user_id = '00000000-0000-0000-0000-000000000002'
      and role = 'owner'
      and is_active = true
  ),
  1::bigint,
  'approval creates exactly one active owner membership'
);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.approve_organization_application('20000000-0000-0000-0000-000000000006') $$
  ),
  'repeated approval is rejected'
);

select is(
  (
    select count(*)
    from public.organization_members
    where user_id = '00000000-0000-0000-0000-000000000002'
      and role = 'owner'
  ),
  1::bigint,
  'repeated approval does not create duplicate owner memberships'
);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.approve_organization_application('20000000-0000-0000-0000-000000000001') $$
  ),
  'draft application cannot be approved'
);

select ok(
  pg_temp.statement_raises(
    $$ select * from public.reject_organization_application(
         '20000000-0000-0000-0000-000000000006',
         'Late rejection'
       ) $$
  ),
  'approved application cannot be rejected'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select is(
  (
    select array_agg(slug order by slug)
    from public.organizations
  ),
  array['active-org'::text, 'approve-review-app-20000000'::text],
  'public user sees only active organizations, including approved applications'
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
