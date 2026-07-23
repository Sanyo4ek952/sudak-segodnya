-- Correct the legacy browser-audit fixture cleanup with the exact remote
-- identity. Requiring id, slug and full name prevents broad matching.

alter table public.organization_members
  disable trigger protect_last_organization_owner_trigger;

do $$
declare
  test_organization_id constant uuid := '2174abb6-f545-4272-8cc7-81ee86461f12';
begin
  if not exists (
    select 1
    from public.organizations organization
    where organization.id = test_organization_id
      and organization.slug = 'codex-1784653614749-c3c4d448'
      and organization.name = 'Тестовая организация Codex 1784653614749'
  ) then
    return;
  end if;

  delete from public.important_announcements
  where publication_id in (
    select publication.id
    from public.publications publication
    where publication.organization_id = test_organization_id
  );

  delete from public.media_assets
  where organization_id = test_organization_id
    or publication_id in (
      select publication.id
      from public.publications publication
      where publication.organization_id = test_organization_id
    )
    or menu_item_id in (
      select item.id
      from public.menu_items item
      where item.organization_id = test_organization_id
    );

  delete from public.publications
  where organization_id = test_organization_id;

  -- Unlink and remove audited child rows while the parent still exists.
  -- Their audit triggers can then write a valid organization_id; the FK on
  -- audit_events will set it to null when the parent is deleted.
  update public.organization_applications
  set organization_id = null,
      updated_at = now()
  where organization_id = test_organization_id;

  delete from public.organization_members
  where organization_id = test_organization_id;

  delete from public.organizations
  where id = test_organization_id;
end
$$;

alter table public.organization_members
  enable trigger protect_last_organization_owner_trigger;
