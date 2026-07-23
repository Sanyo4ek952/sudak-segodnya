-- Secure public analytics ingestion and reasoned administrative moderation.

alter table public.organizations
  add column if not exists moderation_comment text;

update public.organizations
set moderation_comment = 'Причина не была зафиксирована в прежней версии системы'
where status = 'blocked'
  and nullif(btrim(coalesce(moderation_comment, '')), '') is null;

update public.publications
set moderation_comment = 'Причина не была зафиксирована в прежней версии системы'
where status in ('hidden', 'blocked')
  and nullif(btrim(coalesce(moderation_comment, '')), '') is null;

alter table public.organizations
  drop constraint if exists organizations_blocked_has_reason,
  add constraint organizations_blocked_has_reason check (
    status <> 'blocked'
    or nullif(btrim(coalesce(moderation_comment, '')), '') is not null
  );

alter table public.publications
  drop constraint if exists publications_moderated_has_reason,
  add constraint publications_moderated_has_reason check (
    status not in ('hidden', 'blocked')
    or nullif(btrim(coalesce(moderation_comment, '')), '') is not null
  );

alter table public.analytics_events
  drop constraint if exists analytics_events_name_allowed,
  add constraint analytics_events_name_allowed check (
    event_name in (
      'organization_view',
      'organization_click',
      'publication_view',
      'phone_click',
      'route_click',
      'menu_open',
      'favorite_add',
      'share',
      'calendar'
    )
  ),
  add constraint analytics_events_anonymous_id_length check (
    anonymous_id is null or length(anonymous_id) between 8 and 100
  );

drop policy if exists "Public can insert analytics events" on public.analytics_events;
revoke insert on public.analytics_events from anon, authenticated;

create or replace function public.track_public_analytics_event(
  p_event_name text,
  p_organization_id uuid default null,
  p_publication_id uuid default null,
  p_menu_item_id uuid default null,
  p_anonymous_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_event_name text := lower(btrim(coalesce(p_event_name, '')));
  normalized_anonymous_id text := nullif(btrim(coalesce(p_anonymous_id, '')), '');
  event_organization_id uuid := p_organization_id;
  publication_organization_id uuid;
  publication_kind public.publication_type;
  menu_organization_id uuid;
  viewer_key text;
  dedup_key text;
  dedup_window interval;
  existing_event_id uuid;
  created_event_id uuid;
begin
  if normalized_event_name not in (
    'organization_view',
    'organization_click',
    'publication_view',
    'phone_click',
    'route_click',
    'menu_open',
    'favorite_add',
    'share',
    'calendar'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported analytics event';
  end if;

  if p_metadata is null
    or jsonb_typeof(p_metadata) <> 'object'
    or octet_length(p_metadata::text) > 4096
  then
    raise exception using errcode = '22023', message = 'Analytics metadata must be a small JSON object';
  end if;

  if normalized_anonymous_id is not null
    and (
      length(normalized_anonymous_id) not between 8 and 100
      or normalized_anonymous_id !~ '^[A-Za-z0-9:_-]+$'
    )
  then
    raise exception using errcode = '22023', message = 'Invalid anonymous identifier';
  end if;

  if p_publication_id is not null then
    select publication.organization_id, publication.type
      into publication_organization_id, publication_kind
    from public.publications publication
    join public.organizations organization_record
      on organization_record.id = publication.organization_id
    where publication.id = p_publication_id
      and organization_record.status = 'active'
      and public.is_public_publication(publication);

    if publication_organization_id is null then
      raise exception using errcode = '22023', message = 'Public publication not found';
    end if;

    if event_organization_id is not null
      and event_organization_id <> publication_organization_id
    then
      raise exception using errcode = '22023', message = 'Publication does not belong to the organization';
    end if;

    event_organization_id := publication_organization_id;
  end if;

  if p_menu_item_id is not null then
    select item.organization_id
      into menu_organization_id
    from public.menu_items item
    join public.organizations organization_record
      on organization_record.id = item.organization_id
    where item.id = p_menu_item_id
      and item.is_available
      and organization_record.status = 'active';

    if menu_organization_id is null then
      raise exception using errcode = '22023', message = 'Available menu item not found';
    end if;

    if event_organization_id is not null
      and event_organization_id <> menu_organization_id
    then
      raise exception using errcode = '22023', message = 'Menu item does not belong to the organization';
    end if;

    event_organization_id := menu_organization_id;
  end if;

  if event_organization_id is not null
    and not exists (
      select 1
      from public.organizations organization_record
      where organization_record.id = event_organization_id
        and organization_record.status = 'active'
    )
  then
    raise exception using errcode = '22023', message = 'Active organization not found';
  end if;

  if normalized_event_name in ('publication_view', 'share', 'calendar')
    and p_publication_id is null
  then
    raise exception using errcode = '22023', message = 'Publication is required for this event';
  end if;

  if normalized_event_name in ('organization_view', 'organization_click')
    and event_organization_id is null
  then
    raise exception using errcode = '22023', message = 'Organization is required for this event';
  end if;

  if normalized_event_name = 'menu_open'
    and event_organization_id is null
    and p_menu_item_id is null
  then
    raise exception using errcode = '22023', message = 'Menu context is required';
  end if;

  if normalized_event_name in ('phone_click', 'route_click')
    and event_organization_id is null
    and p_publication_id is null
  then
    raise exception using errcode = '22023', message = 'Content context is required';
  end if;

  if normalized_event_name = 'favorite_add'
    and p_publication_id is null
    and event_organization_id is null
  then
    raise exception using errcode = '22023', message = 'Favorite target is required';
  end if;

  if normalized_event_name = 'calendar'
    and publication_kind <> 'event'
  then
    raise exception using errcode = '22023', message = 'Only an event can be added to a calendar';
  end if;

  viewer_key := coalesce(
    auth.uid()::text,
    normalized_anonymous_id,
    'ephemeral:' || gen_random_uuid()::text
  );
  dedup_window := case
    when normalized_event_name in ('organization_view', 'publication_view', 'menu_open')
      then interval '30 minutes'
    else interval '10 seconds'
  end;
  dedup_key := concat_ws(
    ':',
    normalized_event_name,
    coalesce(event_organization_id::text, '-'),
    coalesce(p_publication_id::text, '-'),
    coalesce(p_menu_item_id::text, '-'),
    viewer_key
  );

  perform pg_advisory_xact_lock(hashtextextended(dedup_key, 0));

  if auth.uid() is not null or normalized_anonymous_id is not null then
    select event.id
      into existing_event_id
    from public.analytics_events event
    where event.event_name = normalized_event_name::public.analytics_event_name
      and event.organization_id is not distinct from event_organization_id
      and event.publication_id is not distinct from p_publication_id
      and event.menu_item_id is not distinct from p_menu_item_id
      and event.user_id is not distinct from auth.uid()
      and event.anonymous_id is not distinct from normalized_anonymous_id
      and event.created_at >= now() - dedup_window
    order by event.created_at desc
    limit 1;
  end if;

  if existing_event_id is not null then
    return existing_event_id;
  end if;

  insert into public.analytics_events (
    event_name,
    organization_id,
    publication_id,
    menu_item_id,
    user_id,
    anonymous_id,
    metadata
  )
  values (
    normalized_event_name::public.analytics_event_name,
    event_organization_id,
    p_publication_id,
    p_menu_item_id,
    auth.uid(),
    normalized_anonymous_id,
    p_metadata
  )
  returning id into created_event_id;

  return created_event_id;
end;
$$;

create or replace function public.admin_moderate_publication(
  p_publication_id uuid,
  p_status public.publication_status,
  p_reason text
)
returns public.publications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  updated_publication public.publications;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  if p_status not in ('published', 'hidden', 'blocked') then
    raise exception using errcode = '22023', message = 'Unsupported moderation status';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'Moderation reason is required';
  end if;

  update public.publications
  set status = p_status,
      moderation_comment = case when p_status = 'published' then null else normalized_reason end,
      updated_at = now()
  where id = p_publication_id
    and (
      (p_status in ('hidden', 'blocked') and status in ('published', 'cancelled', 'hidden', 'blocked'))
      or (p_status = 'published' and status in ('hidden', 'blocked'))
    )
  returning * into updated_publication;

  if updated_publication.id is null then
    raise exception using errcode = '22023', message = 'Publication cannot be moderated from its current status';
  end if;

  if p_status = 'published' then
    insert into public.audit_events (
      actor_id, entity_type, entity_id, organization_id, action, reason, new_data
    )
    values (
      auth.uid(),
      'publications',
      updated_publication.id,
      updated_publication.organization_id,
      'publications.restored',
      normalized_reason,
      to_jsonb(updated_publication)
    );
  end if;

  return updated_publication;
end;
$$;

create or replace function public.admin_moderate_organization(
  p_organization_id uuid,
  p_status public.organization_status,
  p_reason text
)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  updated_organization public.organizations;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  if p_status not in ('active', 'blocked') then
    raise exception using errcode = '22023', message = 'Unsupported moderation status';
  end if;

  if normalized_reason is null then
    raise exception using errcode = '22023', message = 'Moderation reason is required';
  end if;

  update public.organizations
  set status = p_status,
      moderation_comment = case when p_status = 'active' then null else normalized_reason end,
      updated_at = now()
  where id = p_organization_id
    and (
      (p_status = 'blocked' and status <> 'blocked')
      or (p_status = 'active' and status = 'blocked')
    )
  returning * into updated_organization;

  if updated_organization.id is null then
    raise exception using errcode = '22023', message = 'Organization cannot be moderated from its current status';
  end if;

  if p_status = 'active' then
    insert into public.audit_events (
      actor_id, entity_type, entity_id, organization_id, action, reason, new_data
    )
    values (
      auth.uid(),
      'organizations',
      updated_organization.id,
      updated_organization.id,
      'organizations.restored',
      normalized_reason,
      to_jsonb(updated_organization)
    );
  end if;

  return updated_organization;
end;
$$;

create or replace function public.write_entity_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_json jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_json jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  target_id uuid := coalesce((new_json ->> 'id')::uuid, (old_json ->> 'id')::uuid);
  target_organization_id uuid;
  event_action text;
  event_reason text;
  old_status text := old_json ->> 'status';
  new_status text := new_json ->> 'status';
begin
  target_organization_id := case
    when tg_table_name = 'organizations' and tg_op = 'DELETE' then null
    when tg_table_name = 'organizations' then target_id
    else coalesce(
      (new_json ->> 'organization_id')::uuid,
      (old_json ->> 'organization_id')::uuid
    )
  end;

  event_action := case
    when tg_op = 'INSERT' then tg_table_name || '.created'
    when tg_op = 'DELETE' then tg_table_name || '.deleted'
    when old_status is distinct from new_status then tg_table_name || '.status.' || coalesce(new_status, 'none')
    when tg_table_name = 'organization_members'
      and (old_json ->> 'role') is distinct from (new_json ->> 'role')
      then 'organization_members.role.' || coalesce(new_json ->> 'role', 'none')
    when tg_table_name = 'organization_members'
      and (old_json ->> 'is_active') is distinct from (new_json ->> 'is_active')
      then 'organization_members.access.' || coalesce(new_json ->> 'is_active', 'false')
    else tg_table_name || '.updated'
  end;

  event_reason := case
    when tg_table_name = 'organization_applications'
      then nullif(btrim(coalesce(new_json ->> 'admin_comment', old_json ->> 'admin_comment', '')), '')
    when tg_table_name in ('publications', 'organizations')
      then nullif(btrim(coalesce(new_json ->> 'moderation_comment', old_json ->> 'moderation_comment', '')), '')
    else null
  end;

  insert into public.audit_events (
    actor_id,
    entity_type,
    entity_id,
    organization_id,
    action,
    reason,
    old_data,
    new_data
  )
  values (
    auth.uid(),
    tg_table_name,
    target_id,
    target_organization_id,
    event_action,
    event_reason,
    old_json,
    new_json
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.track_public_analytics_event(
  text, uuid, uuid, uuid, text, jsonb
) from public;
revoke all on function public.admin_moderate_publication(
  uuid, public.publication_status, text
) from public, anon, authenticated;
revoke all on function public.admin_moderate_organization(
  uuid, public.organization_status, text
) from public, anon, authenticated;

grant execute on function public.track_public_analytics_event(
  text, uuid, uuid, uuid, text, jsonb
) to anon, authenticated;
grant execute on function public.admin_moderate_publication(
  uuid, public.publication_status, text
) to authenticated;
grant execute on function public.admin_moderate_organization(
  uuid, public.organization_status, text
) to authenticated;
