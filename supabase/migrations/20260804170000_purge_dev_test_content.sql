-- One-time cleanup of the inventoried development catalog.
-- The allowlists make this migration fail closed if an unexpected organization or
-- publication exists. Auth users, profiles, admins, taxonomies, app configuration,
-- and content_sources are intentionally preserved.

do $$
declare
  allowed_organization_ids constant uuid[] := array[
    '21000000-0000-0000-0000-000000000001'::uuid,
    '21000000-0000-0000-0000-000000000002'::uuid,
    '21000000-0000-0000-0000-000000000003'::uuid,
    '21000000-0000-0000-0000-000000000004'::uuid,
    '21000000-0000-0000-0000-000000000005'::uuid,
    '21000000-0000-0000-0000-000000000006'::uuid,
    '21000000-0000-0000-0000-000000000007'::uuid,
    '21000000-0000-0000-0000-000000000008'::uuid,
    '21000000-0000-0000-0000-000000000009'::uuid,
    '76123507-6489-4917-a071-f1676c8b805c'::uuid
  ];
  allowed_publication_ids constant uuid[] := array[
    '22000000-0000-0000-0000-000000000001'::uuid,
    '22000000-0000-0000-0000-000000000002'::uuid,
    '22000000-0000-0000-0000-000000000003'::uuid,
    '22000000-0000-0000-0000-000000000004'::uuid,
    '22000000-0000-0000-0000-000000000005'::uuid,
    '22000000-0000-0000-0000-000000000006'::uuid,
    '22000000-0000-0000-0000-000000000007'::uuid,
    '22000000-0000-0000-0000-000000000008'::uuid,
    '22000000-0000-0000-0000-000000000009'::uuid,
    '22000000-0000-0000-0000-000000000010'::uuid,
    '22000000-0000-0000-0000-000000000011'::uuid,
    '22000000-0000-0000-0000-000000000012'::uuid
  ];
begin
  perform pg_advisory_xact_lock(hashtextextended('sudak-today-dev-content-cleanup-20260804', 0));

  if exists (
    select 1 from public.organizations organization
    where not (organization.id = any(allowed_organization_ids))
  ) then
    raise exception 'Development cleanup stopped: an unexpected organization exists';
  end if;

  if exists (
    select 1 from public.publications publication
    where not (publication.id = any(allowed_publication_ids))
  ) then
    raise exception 'Development cleanup stopped: an unexpected publication exists';
  end if;

  delete from public.content_candidates;
  delete from public.content_ingestion_runs;

  delete from public.important_announcements;
  delete from public.analytics_events;
  delete from public.inaccuracy_reports;
  delete from public.publication_schedules;
  delete from public.media_assets;
  delete from public.menu_items;
  delete from public.menu_categories;
  delete from public.organization_member_invitations;
  delete from public.organization_applications;

  alter table public.organization_members
    disable trigger protect_last_organization_owner_trigger;
  delete from public.organization_members;
  alter table public.organization_members
    enable trigger protect_last_organization_owner_trigger;

  delete from public.publications;
  delete from public.organizations;

  delete from public.audit_events audit
  where audit.organization_id is not null
    or audit.entity_type in (
      'organizations',
      'publications',
      'publication_schedules',
      'menu_categories',
      'menu_items',
      'organization_members',
      'organization_member_invitations',
      'organization_applications',
      'media_assets',
      'important_announcements',
      'inaccuracy_reports',
      'analytics_events',
      'content_candidates',
      'content_ingestion_runs'
    );

  if exists (select 1 from public.organizations)
    or exists (select 1 from public.publications)
    or exists (select 1 from public.content_candidates)
  then
    raise exception 'Development cleanup verification failed';
  end if;
end;
$$;

notify pgrst, 'reload schema';
