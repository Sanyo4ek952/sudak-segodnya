create or replace function public.make_organization_slug(name text, application_id uuid)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'org'
  ) || '-' || left(replace(application_id::text, '-', ''), 8);
$$;

create or replace function public.approve_organization_application(application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_application public.organization_applications;
  created_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_admin() then
    raise exception 'Only administrators can approve applications';
  end if;

  select *
  into locked_application
  from public.organization_applications
  where id = approve_organization_application.application_id
  for update;

  if locked_application.id is null then
    raise exception 'Application not found';
  end if;

  if locked_application.status <> 'submitted' then
    raise exception 'Application cannot be approved from current status';
  end if;

  if locked_application.organization_id is not null then
    raise exception 'Application is already linked to an organization';
  end if;

  if nullif(btrim(coalesce(locked_application.organization_name, '')), '') is null
    or locked_application.category_id is null
    or nullif(btrim(coalesce(locked_application.description, '')), '') is null
    or nullif(btrim(coalesce(locked_application.address, '')), '') is null
    or nullif(btrim(coalesce(locked_application.phone, '')), '') is null then
    raise exception 'Application has incomplete organization data';
  end if;

  insert into public.organizations (
    slug,
    name,
    description,
    status,
    address,
    phone,
    category_id,
    created_by
  )
  values (
    public.make_organization_slug(locked_application.organization_name, locked_application.id),
    btrim(locked_application.organization_name),
    btrim(locked_application.description),
    'active',
    btrim(locked_application.address),
    btrim(locked_application.phone),
    locked_application.category_id,
    locked_application.applicant_id
  )
  returning id into created_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    is_active
  )
  values (
    created_organization_id,
    locked_application.applicant_id,
    'owner',
    true
  );

  update public.organization_applications
  set organization_id = created_organization_id,
      status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_comment = null
  where id = locked_application.id;

  return jsonb_build_object(
    'application_id', locked_application.id,
    'organization_id', created_organization_id,
    'status', 'approved'
  );
end;
$$;

create or replace function public.request_organization_application_changes(
  application_id uuid,
  admin_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_application public.organization_applications;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_admin() then
    raise exception 'Only administrators can request application changes';
  end if;

  if nullif(btrim(coalesce(request_organization_application_changes.admin_comment, '')), '') is null then
    raise exception 'Admin comment is required';
  end if;

  update public.organization_applications
  set status = 'needs_changes',
      admin_comment = btrim(request_organization_application_changes.admin_comment),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = request_organization_application_changes.application_id
    and status = 'submitted'
    and organization_id is null
  returning * into updated_application;

  if updated_application.id is null then
    raise exception 'Application cannot request changes from current status';
  end if;

  return jsonb_build_object(
    'application_id', updated_application.id,
    'status', updated_application.status
  );
end;
$$;

create or replace function public.reject_organization_application(
  application_id uuid,
  admin_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_application public.organization_applications;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_admin() then
    raise exception 'Only administrators can reject applications';
  end if;

  if nullif(btrim(coalesce(reject_organization_application.admin_comment, '')), '') is null then
    raise exception 'Rejection reason is required';
  end if;

  update public.organization_applications
  set status = 'rejected',
      admin_comment = btrim(reject_organization_application.admin_comment),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = reject_organization_application.application_id
    and status in ('submitted', 'needs_changes')
    and organization_id is null
  returning * into updated_application;

  if updated_application.id is null then
    raise exception 'Application cannot be rejected from current status';
  end if;

  return jsonb_build_object(
    'application_id', updated_application.id,
    'status', updated_application.status
  );
end;
$$;

grant execute on function public.approve_organization_application(uuid) to authenticated;
grant execute on function public.request_organization_application_changes(uuid, text) to authenticated;
grant execute on function public.reject_organization_application(uuid, text) to authenticated;
