-- Remove the exact browser-audit fixture that accidentally reached the public catalog.
-- The double predicate prevents broad deletion of legitimate organizations.

alter table public.organization_members
  disable trigger protect_last_organization_owner_trigger;

do $$
declare
  test_organization_id uuid;
begin
  select organization.id
    into test_organization_id
  from public.organizations organization
  where organization.slug = 'codex-1784653614749-c3c4d448'
    and lower(btrim(organization.name)) like 'codex%'
  limit 1;

  if test_organization_id is null then
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

  delete from public.organizations
  where id = test_organization_id;
end
$$;

alter table public.organization_members
  enable trigger protect_last_organization_owner_trigger;
