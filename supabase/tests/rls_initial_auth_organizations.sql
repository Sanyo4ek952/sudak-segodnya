begin;

set search_path = public;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(condition, false) then
    raise exception 'RLS check failed: %', message;
  end if;
end;
$$;

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
  ('00000000-0000-0000-0000-000000000003', 'admin@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, role, display_name)
values
  ('00000000-0000-0000-0000-000000000001', 'user', 'User One'),
  ('00000000-0000-0000-0000-000000000002', 'user', 'User Two'),
  ('00000000-0000-0000-0000-000000000003', 'admin', 'Admin')
on conflict (id) do update
set role = excluded.role,
    display_name = excluded.display_name;

insert into public.organizations (id, slug, name, status, created_by)
values
  ('10000000-0000-0000-0000-000000000001', 'active-org', 'Active Org', 'active', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000002', 'pending-org', 'Pending Org', 'pending', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000003', 'member-org', 'Member Org', 'pending', '00000000-0000-0000-0000-000000000003');

insert into public.organization_members (organization_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'manager');

insert into public.organization_applications (id, applicant_id, status, organization_name)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'draft', 'User One App'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'draft', 'User Two App');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(
  (select count(*) = 1 from public.organization_applications),
  'user does not read another user application'
);

select pg_temp.assert_true(
  pg_temp.statement_raises(
    $$ update public.organization_applications
       set status = 'approved'
       where id = '20000000-0000-0000-0000-000000000001' $$
  ),
  'user cannot change application status'
);

select pg_temp.assert_true(
  pg_temp.statement_raises(
    $$ insert into public.organization_members (organization_id, user_id, role)
       values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'manager') $$
  ),
  'user cannot add themselves to another organization'
);

update public.organization_members
set role = 'owner'
where organization_id = '10000000-0000-0000-0000-000000000003'
  and user_id = '00000000-0000-0000-0000-000000000001';

select pg_temp.assert_true(
  (
    select role = 'manager'
    from public.organization_members
    where organization_id = '10000000-0000-0000-0000-000000000003'
      and user_id = '00000000-0000-0000-0000-000000000001'
  ),
  'representative cannot promote their own role'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select pg_temp.assert_true(
  (
    select array_agg(slug order by slug) = array['active-org'::text]
    from public.organizations
  ),
  'public user sees only active organizations'
);

rollback;
