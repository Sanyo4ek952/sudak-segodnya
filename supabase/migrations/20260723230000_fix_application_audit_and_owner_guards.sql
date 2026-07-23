-- Corrections discovered by the full local RLS/RPC test run.

-- Applicants may edit a needs_changes row while preserving administrator review
-- metadata. The immutable-field trigger still prevents them from changing the
-- review fields or technical status directly.
drop policy if exists "Users can update own applications"
  on public.organization_applications;

create policy "Users can update own applications"
on public.organization_applications
for update
to authenticated
using (
  public.is_admin()
  or (
    applicant_id = auth.uid()
    and status in ('draft', 'needs_changes')
    and organization_id is null
  )
)
with check (
  public.is_admin()
  or (
    applicant_id = auth.uid()
    and status in ('draft', 'needs_changes')
    and organization_id is null
  )
);

-- A SELECT policy does not grant the underlying table privilege by itself.
-- RLS continues to restrict rows to admins, owners and the application author.
grant select on public.audit_events to authenticated;

-- Protect the last owner while the organization exists, but do not block the
-- foreign-key ON DELETE CASCADE when an administrator removes the organization.
create or replace function public.protect_last_organization_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE'
    and not exists (
      select 1
      from public.organizations organization_record
      where organization_record.id = old.organization_id
    )
  then
    return old;
  end if;

  if old.role = 'owner'
    and old.is_active
    and (
      tg_op = 'DELETE'
      or not new.is_active
      or new.role <> 'owner'
    )
    and (
      select count(*)
      from public.organization_members owner_record
      where owner_record.organization_id = old.organization_id
        and owner_record.role = 'owner'
        and owner_record.is_active
    ) <= 1
  then
    raise exception using
      errcode = '23514',
      message = 'The last active owner cannot be removed or demoted';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
