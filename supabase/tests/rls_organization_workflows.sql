begin;

set search_path = public, extensions;

select plan(17);

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

create or replace function pg_temp.accept_latest_invitation()
returns boolean
language plpgsql
as $$
declare
  invitation_token text;
begin
  select token into invitation_token
  from pg_temp.created_invitation
  limit 1;

  perform public.accept_organization_invitation(invitation_token);
  return true;
exception when others then
  return false;
end;
$$;

alter table public.organization_members
  disable trigger protect_last_organization_owner_trigger;

delete from public.organization_member_invitations
where organization_id::text like '21200000-%';
delete from public.organization_members
where organization_id::text like '21200000-%';
delete from public.organization_applications
where id::text like '20200000-%';
delete from public.organizations
where id::text like '21200000-%';

alter table public.organization_members
  enable trigger protect_last_organization_owner_trigger;

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000031', 'workflow-applicant@example.test'),
  ('00000000-0000-0000-0000-000000000032', 'workflow-manager@example.test'),
  ('00000000-0000-0000-0000-000000000033', 'workflow-invitee@example.test'),
  ('00000000-0000-0000-0000-000000000034', 'workflow-admin@example.test')
on conflict (id) do update set email = excluded.email;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000031', 'user', 'Workflow Applicant'),
  ('00000000-0000-0000-0000-000000000032', 'user', 'Workflow Manager'),
  ('00000000-0000-0000-0000-000000000033', 'user', 'Workflow Invitee'),
  ('00000000-0000-0000-0000-000000000034', 'admin', 'Workflow Admin')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

insert into public.organization_types (id, slug, name, sort_order)
values ('30200000-0000-0000-0000-000000000001', 'workflow-tests', 'Workflow Tests', 998)
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

insert into public.organizations (
  id, slug, name, description, phone, status, type_id, created_by
)
values (
  '21200000-0000-0000-0000-000000000001',
  'workflow-existing-organization',
  'Workflow Existing Organization',
  'Existing organization used by workflow tests',
  '+7 900 000-00-31',
  'active',
  (select id from public.organization_types where slug = 'workflow-tests'),
  '00000000-0000-0000-0000-000000000031'
);

insert into public.organization_members (organization_id, user_id, role, is_active)
values
  ('21200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', 'owner', true),
  ('21200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000032', 'manager', true);

insert into public.organization_applications (
  id,
  applicant_id,
  status,
  organization_name,
  type_id,
  description,
  address,
  phone,
  relationship,
  confirmation_info,
  admin_comment,
  submitted_at,
  reviewed_at,
  reviewed_by
)
values (
  '20200000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000031',
  'needs_changes',
  'Workflow Second Organization',
  (select id from public.organization_types where slug = 'workflow-tests'),
  'Second organization with complete product data',
  'Sudak',
  '+7 900 000-00-32',
  'Owner',
  'Registration documents checked',
  'Please clarify the description',
  now() - interval '2 days',
  now() - interval '1 day',
  '00000000-0000-0000-0000-000000000034'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);

update public.organization_applications
set description = 'Clarified complete description for the second organization'
where id = '20200000-0000-0000-0000-000000000001';

select is(
  (
    select status::text
    from public.submit_organization_application('20200000-0000-0000-0000-000000000001')
  ),
  'submitted',
  'needs_changes application can be edited and resubmitted'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000034', true);

select lives_ok(
  $$ select public.approve_organization_application('20200000-0000-0000-0000-000000000001') $$,
  'administrator approves a submitted application'
);

select is(
  (
    select status::text
    from public.organization_applications
    where id = '20200000-0000-0000-0000-000000000001'
  ),
  'approved',
  'approval links an approved application'
);

select ok(
  exists (
    select 1
    from public.organization_members member_record
    join public.organization_applications application
      on application.organization_id = member_record.organization_id
    where application.id = '20200000-0000-0000-0000-000000000001'
      and member_record.user_id = '00000000-0000-0000-0000-000000000031'
      and member_record.role = 'owner'
      and member_record.is_active
  ),
  'approval atomically creates owner membership'
);

select lives_ok(
  $$ select public.approve_organization_application('20200000-0000-0000-0000-000000000001') $$,
  'repeated approval is idempotent'
);

select is(
  (
    select count(*)::integer
    from public.organizations organization_record
    join public.organization_applications application
      on application.organization_id = organization_record.id
    where application.id = '20200000-0000-0000-0000-000000000001'
  ),
  1,
  'repeated approval does not create a duplicate organization'
);

select is(
  (
    select count(*)::integer
    from public.organization_members
    where user_id = '00000000-0000-0000-0000-000000000031'
      and is_active
  ),
  2,
  'one user can own multiple organizations'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000032', true);

select ok(
  pg_temp.statement_raises(
    $$ select public.invite_organization_representative(
      '21200000-0000-0000-0000-000000000001',
      'workflow-invitee@example.test',
      'manager'
    ) $$
  ),
  'manager cannot invite representatives'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.manage_organization_representative(
      '21200000-0000-0000-0000-000000000001',
      (
        select id from public.organization_members
        where organization_id = '21200000-0000-0000-0000-000000000001'
          and user_id = '00000000-0000-0000-0000-000000000032'
      ),
      'change_role',
      'owner'
    ) $$
  ),
  'manager cannot promote itself'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);

create temporary table created_invitation as
select result ->> 'token' as token
from (
  select public.invite_organization_representative(
    '21200000-0000-0000-0000-000000000001',
    'workflow-invitee@example.test',
    'manager'
  ) as result
) invitation;

select ok(
  (select length(token) >= 32 from pg_temp.created_invitation),
  'owner creates a representative invitation with a one-time token'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000033', true);

select ok(
  pg_temp.accept_latest_invitation(),
  'matching invited user accepts the invitation'
);

select ok(
  exists (
    select 1
    from public.organization_members
    where organization_id = '21200000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-000000000033'
      and role = 'manager'
      and is_active
  ),
  'accepted invitation creates active manager membership'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000031', true);

select lives_ok(
  $$ select public.manage_organization_representative(
    '21200000-0000-0000-0000-000000000001',
    (
      select id from public.organization_members
      where organization_id = '21200000-0000-0000-0000-000000000001'
        and user_id = '00000000-0000-0000-0000-000000000033'
    ),
    'deactivate',
    null
  ) $$,
  'owner can deactivate a manager'
);

select ok(
  pg_temp.statement_raises(
    $$ select public.manage_organization_representative(
      '21200000-0000-0000-0000-000000000001',
      (
        select id from public.organization_members
        where organization_id = '21200000-0000-0000-0000-000000000001'
          and user_id = '00000000-0000-0000-0000-000000000031'
      ),
      'deactivate',
      null
    ) $$
  ),
  'last active owner cannot be deactivated'
);

select ok(
  exists (
    select 1
    from public.audit_events
    where entity_type in ('organization_applications', 'organization_members')
      and (
        entity_id = '20200000-0000-0000-0000-000000000001'
        or organization_id = '21200000-0000-0000-0000-000000000001'
      )
  ),
  'application and representative actions have an audit trail'
);

select lives_ok(
  $$ select public.transfer_organization_ownership(
    '21200000-0000-0000-0000-000000000001',
    (
      select id from public.organization_members
      where organization_id = '21200000-0000-0000-0000-000000000001'
        and user_id = '00000000-0000-0000-0000-000000000032'
    ),
    false
  ) $$,
  'owner transfers ownership atomically to an active manager'
);

select ok(
  (
    select role = 'owner'
    from public.organization_members
    where organization_id = '21200000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-000000000032'
  )
  and (
    select role = 'manager'
    from public.organization_members
    where organization_id = '21200000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-000000000031'
  ),
  'ownership transfer promotes target and demotes previous owner in one transaction'
);

select * from finish();

rollback;
