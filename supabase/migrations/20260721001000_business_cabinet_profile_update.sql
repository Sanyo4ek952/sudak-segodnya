create or replace function public.update_member_organization_profile(
  organization_id uuid,
  name text,
  description text,
  address text,
  phone text,
  working_hours text
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_organization public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_org_member(update_member_organization_profile.organization_id) then
    raise exception 'Organization membership is required';
  end if;

  update public.organizations
  set name = btrim(update_member_organization_profile.name),
      description = btrim(update_member_organization_profile.description),
      address = btrim(update_member_organization_profile.address),
      phone = btrim(update_member_organization_profile.phone),
      working_hours = nullif(btrim(coalesce(update_member_organization_profile.working_hours, '')), ''),
      last_public_update_at = now()
  where id = update_member_organization_profile.organization_id
    and status = 'active'
    and nullif(btrim(update_member_organization_profile.name), '') is not null
    and nullif(btrim(update_member_organization_profile.description), '') is not null
    and nullif(btrim(update_member_organization_profile.address), '') is not null
    and nullif(btrim(update_member_organization_profile.phone), '') is not null
  returning * into updated_organization;

  if updated_organization.id is null then
    raise exception 'Organization cannot be updated';
  end if;

  return updated_organization;
end;
$$;

grant execute on function public.update_member_organization_profile(uuid, text, text, text, text, text) to authenticated;
