-- Complete organization profile contract and safely review primary type changes.

alter table public.organizations
  add column if not exists pending_type_id uuid references public.organization_types(id),
  add column if not exists type_change_requested_at timestamptz,
  add column if not exists type_change_requested_by uuid references auth.users(id) on delete set null;

create index if not exists organizations_pending_type_idx
  on public.organizations(pending_type_id, type_change_requested_at)
  where pending_type_id is not null;

create or replace function public.update_member_organization_profile_v2(
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_address text,
  p_phone text,
  p_working_hours text,
  p_latitude double precision,
  p_longitude double precision,
  p_contact_links jsonb,
  p_type_id uuid
)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  current_organization public.organizations;
  updated_organization public.organizations;
begin
  if actor_id is null
    or not public.is_org_member(p_organization_id)
  then
    raise exception using errcode = '42501', message = 'Organization membership is required';
  end if;

  select organization_record.*
    into current_organization
  from public.organizations organization_record
  where organization_record.id = p_organization_id
  for update;

  if current_organization.id is null
    or current_organization.status <> 'active'
  then
    raise exception using errcode = '22023', message = 'Active organization not found';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null
    or char_length(btrim(p_name)) > 160
    or nullif(btrim(coalesce(p_description, '')), '') is null
    or nullif(btrim(coalesce(p_address, '')), '') is null
    or nullif(btrim(coalesce(p_phone, '')), '') is null
  then
    raise exception using errcode = '22023', message = 'Required profile fields are incomplete';
  end if;

  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then
    raise exception using errcode = '22023', message = 'Latitude is out of range';
  end if;

  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then
    raise exception using errcode = '22023', message = 'Longitude is out of range';
  end if;

  if jsonb_typeof(coalesce(p_contact_links, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'Contact links must be a JSON object';
  end if;

  if not exists (
    select 1
    from public.organization_types type_record
    where type_record.id = p_type_id
      and type_record.is_active
  ) then
    raise exception using errcode = '22023', message = 'Active organization type not found';
  end if;

  if p_type_id <> current_organization.type_id
    and not public.is_org_owner(p_organization_id)
  then
    raise exception using errcode = '42501', message = 'Only an owner can request a primary type change';
  end if;

  update public.organizations
  set name = btrim(p_name),
      description = btrim(p_description),
      address = btrim(p_address),
      phone = btrim(p_phone),
      working_hours = nullif(btrim(coalesce(p_working_hours, '')), ''),
      latitude = p_latitude,
      longitude = p_longitude,
      contact_links = coalesce(p_contact_links, '{}'::jsonb),
      pending_type_id = case
        when p_type_id <> current_organization.type_id then p_type_id
        else null
      end,
      type_change_requested_at = case
        when p_type_id <> current_organization.type_id then now()
        else null
      end,
      type_change_requested_by = case
        when p_type_id <> current_organization.type_id then actor_id
        else null
      end,
      last_public_update_at = now(),
      updated_at = now()
  where id = p_organization_id
  returning * into updated_organization;

  return updated_organization;
end;
$$;

create or replace function public.review_organization_type_change(
  p_organization_id uuid,
  p_approve boolean,
  p_reason text
)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_organization public.organizations;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  update public.organizations
  set type_id = case when p_approve then pending_type_id else type_id end,
      pending_type_id = null,
      type_change_requested_at = null,
      type_change_requested_by = null,
      last_public_update_at = case when p_approve then now() else last_public_update_at end,
      updated_at = now()
  where id = p_organization_id
    and pending_type_id is not null
  returning * into updated_organization;

  if updated_organization.id is null then
    raise exception using errcode = '22023', message = 'Pending type change not found';
  end if;

  insert into public.audit_events (
    actor_id,
    entity_type,
    entity_id,
    organization_id,
    action,
    reason,
    new_data
  )
  values (
    auth.uid(),
    'organizations',
    updated_organization.id,
    updated_organization.id,
    case when p_approve then 'organizations.type_change.approved' else 'organizations.type_change.rejected' end,
    nullif(btrim(coalesce(p_reason, '')), ''),
    to_jsonb(updated_organization)
  );

  return updated_organization;
end;
$$;

revoke all on function public.update_member_organization_profile_v2(
  uuid, text, text, text, text, text, double precision, double precision, jsonb, uuid
) from public, anon;
revoke all on function public.review_organization_type_change(uuid, boolean, text) from public, anon, authenticated;

grant execute on function public.update_member_organization_profile_v2(
  uuid, text, text, text, text, text, double precision, double precision, jsonb, uuid
) to authenticated;
grant execute on function public.review_organization_type_change(uuid, boolean, text) to authenticated;
