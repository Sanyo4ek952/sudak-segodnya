-- VK-specific intake. Posts remain private until an administrator prepares a
-- content_candidates record and completes the existing guarded review flow.

do $$
begin
  create type public.external_platform as enum ('vk');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.external_item_status as enum ('new', 'imported', 'ignored', 'error');
exception when duplicate_object then null;
end $$;

create table public.external_sources (
  id uuid primary key default gen_random_uuid(),
  platform public.external_platform not null default 'vk',
  external_id text,
  domain text not null,
  name text not null,
  url text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_sync_error text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_sources_domain_not_empty check (
    nullif(btrim(domain), '') is not null and char_length(domain) <= 100
  ),
  constraint external_sources_domain_format check (
    domain ~ '^[A-Za-z0-9_.-]+$'
  ),
  constraint external_sources_name_not_empty check (
    nullif(btrim(name), '') is not null and char_length(name) <= 180
  ),
  constraint external_sources_vk_url check (
    lower(url) ~ '^https://vk[.]com/[a-z0-9_.-]+/?$'
    and lower(rtrim(url, '/')) = ('https://vk.com/' || lower(domain))
  ),
  constraint external_sources_external_id_format check (
    external_id is null or external_id ~ '^-?[0-9]+$'
  ),
  constraint external_sources_error_length check (
    last_sync_error is null or char_length(last_sync_error) <= 1000
  )
);

create unique index external_sources_platform_domain_uidx
  on public.external_sources(platform, lower(domain));
create unique index external_sources_platform_external_id_uidx
  on public.external_sources(platform, external_id)
  where external_id is not null;
create index external_sources_active_idx
  on public.external_sources(platform, is_active, id)
  where is_active;
create index external_sources_organization_idx
  on public.external_sources(organization_id, is_active)
  where organization_id is not null;

create table public.external_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.external_sources(id) on delete restrict,
  external_id text not null,
  source_url text not null,
  text text not null default '',
  published_at timestamptz not null,
  media jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null,
  status public.external_item_status not null default 'new',
  publication_id uuid references public.publications(id) on delete restrict,
  content_candidate_id uuid references public.content_candidates(id) on delete restrict,
  imported_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_items_external_id_not_empty check (
    nullif(btrim(external_id), '') is not null and char_length(external_id) <= 200
  ),
  constraint external_items_vk_source_url check (
    lower(source_url) ~ '^https://vk[.]com/wall-?[0-9]+_[0-9]+$'
  ),
  constraint external_items_media_array check (jsonb_typeof(media) = 'array'),
  constraint external_items_raw_payload_object check (jsonb_typeof(raw_payload) = 'object'),
  constraint external_items_status_metadata check (
    (
      status = 'imported'
      and publication_id is not null
      and content_candidate_id is not null
      and imported_at is not null
      and reviewed_at is not null
    )
    or (
      status = 'ignored'
      and publication_id is null
      and imported_at is null
      and reviewed_at is not null
    )
    or (
      status in ('new', 'error')
      and publication_id is null
      and imported_at is null
    )
  )
);

create unique index external_items_source_external_id_uidx
  on public.external_items(source_id, external_id);
create unique index external_items_publication_uidx
  on public.external_items(publication_id)
  where publication_id is not null;
create unique index external_items_candidate_uidx
  on public.external_items(content_candidate_id)
  where content_candidate_id is not null;
create index external_items_review_queue_idx
  on public.external_items(status, published_at desc, id);
create index external_items_source_status_idx
  on public.external_items(source_id, status, published_at desc, id);

drop trigger if exists set_external_sources_updated_at on public.external_sources;
create trigger set_external_sources_updated_at
before update on public.external_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_external_items_updated_at on public.external_items;
create trigger set_external_items_updated_at
before update on public.external_items
for each row execute function public.set_updated_at();

alter table public.external_sources enable row level security;
alter table public.external_items enable row level security;

create policy "Admins can read external sources"
on public.external_sources for select to authenticated
using (public.is_admin());

create policy "Admins can create external sources"
on public.external_sources for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy "Admins can update external sources"
on public.external_sources for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can read external items"
on public.external_items for select to authenticated
using (public.is_admin());

revoke all on table public.external_sources from public, anon, authenticated;
revoke all on table public.external_items from public, anon, authenticated;
grant select, insert, update on table public.external_sources to authenticated;
grant select on table public.external_items to authenticated;
grant select, insert, update, delete on table public.external_sources to service_role;
grant select, insert, update, delete on table public.external_items to service_role;

create or replace function public.prepare_vk_external_item_for_review(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  item_record public.external_items;
  source_record public.external_sources;
  organization_name text;
  category_slug text;
  candidate_id uuid;
  candidate_title text;
  primary_image_url text;
  source_published_at text;
  valid_until text;
  content_hash text;
  candidate_payload jsonb;
  candidate_warnings jsonb;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select item.*
    into item_record
  from public.external_items item
  where item.id = p_item_id
  for update;

  if item_record.id is null then
    raise exception using errcode = '22023', message = 'VK external item not found';
  end if;
  if item_record.status <> 'new' then
    raise exception using errcode = '22023', message = 'Only a new VK item can be prepared';
  end if;
  if item_record.content_candidate_id is not null then
    return item_record.content_candidate_id;
  end if;

  select source.*
    into source_record
  from public.external_sources source
  where source.id = item_record.source_id;

  if source_record.id is null then
    raise exception using errcode = '22023', message = 'VK external source not found';
  end if;

  if source_record.organization_id is not null then
    select organization.name
      into organization_name
    from public.organizations organization
    where organization.id = source_record.organization_id
      and organization.status = 'active';
  end if;
  organization_name := coalesce(organization_name, source_record.name);

  select category.slug
    into category_slug
  from public.publication_categories category
  where category.is_active
  order by (category.slug = 'city') desc, category.sort_order, category.id
  limit 1;

  if category_slug is null then
    raise exception using errcode = '22023', message = 'Active publication category not found';
  end if;

  select nullif(btrim(line), '')
    into candidate_title
  from regexp_split_to_table(coalesce(item_record.text, ''), E'\\r?\\n') line
  where nullif(btrim(line), '') is not null
  limit 1;
  candidate_title := left(
    coalesce(candidate_title, 'Публикация VK ' || to_char(item_record.published_at at time zone 'Europe/Moscow', 'DD.MM.YYYY')),
    180
  );
  if char_length(candidate_title) < 3 then
    candidate_title := candidate_title || ' VK';
  end if;

  select media_item ->> 'sourceUrl'
    into primary_image_url
  from jsonb_array_elements(item_record.media) media_item
  where media_item ->> 'type' = 'photo'
    and lower(coalesce(media_item ->> 'sourceUrl', '')) like 'https://%'
    and char_length(media_item ->> 'sourceUrl') <= 1000
  order by
    coalesce((media_item ->> 'width')::integer, 0)
      * coalesce((media_item ->> 'height')::integer, 0) desc
  limit 1;

  source_published_at := to_char(
    item_record.published_at at time zone 'Europe/Moscow',
    'YYYY-MM-DD"T"HH24:MI:SS'
  ) || '+03:00';
  valid_until := to_char(
    (item_record.published_at + interval '7 days') at time zone 'Europe/Moscow',
    'YYYY-MM-DD"T"HH24:MI:SS'
  ) || '+03:00';
  content_hash := encode(digest(item_record.raw_payload::text, 'sha256'), 'hex');

  candidate_payload := jsonb_build_object(
    'kind', 'publication',
    'organizationId', source_record.organization_id,
    'organizationName', organization_name,
    'targetPublicationId', null,
    'type', 'news',
    'title', candidate_title,
    'description', left(nullif(btrim(item_record.text), ''), 4000),
    'categorySlug', category_slug,
    'startsAt', null,
    'endsAt', null,
    'validUntil', valid_until,
    'sourcePublishedAt', source_published_at,
    'place', null,
    'priceText', null,
    'isFree', false,
    'ageLimit', null,
    'contactPhone', null,
    'scheduleEntries', '[]'::jsonb,
    'imageSourceUrl', primary_image_url
  );

  candidate_warnings := jsonb_build_array(
    'Материал получен из VK. Проверьте тип, категорию и все обязательные поля перед решением.'
  );
  if jsonb_typeof(item_record.raw_payload -> 'copy_history') = 'array'
    and jsonb_array_length(item_record.raw_payload -> 'copy_history') > 0
  then
    candidate_warnings := candidate_warnings || jsonb_build_array(
      'Репост обработан консервативно: copy_history и его вложения не переносились.'
    );
  end if;

  insert into public.content_candidates (
    action,
    status,
    payload,
    evidence,
    warnings,
    source_url,
    source_checked_at,
    external_id,
    content_hash,
    source_version_hash,
    normalized_fingerprint,
    target_organization_id,
    source_excerpt
  )
  values (
    'create_publication',
    'pending',
    candidate_payload,
    jsonb_build_array(jsonb_build_object(
      'field', 'description',
      'excerpt', left(coalesce(nullif(btrim(item_record.text), ''), 'Публикация VK без текста'), 300),
      'sourceUrl', item_record.source_url
    )),
    candidate_warnings,
    item_record.source_url,
    now(),
    'vk:' || source_record.id::text || ':' || item_record.external_id,
    content_hash,
    content_hash,
    encode(digest(source_record.id::text || ':' || item_record.external_id, 'sha256'), 'hex'),
    source_record.organization_id,
    left(item_record.text, 4000)
  )
  returning id into candidate_id;

  update public.external_items
  set content_candidate_id = candidate_id,
      updated_at = now()
  where id = item_record.id;

  return candidate_id;
end;
$$;

revoke all on function public.prepare_vk_external_item_for_review(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.prepare_vk_external_item_for_review(uuid) to authenticated;

create or replace function public.ignore_vk_external_item(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  item_record public.external_items;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select item.*
    into item_record
  from public.external_items item
  where item.id = p_item_id
  for update;

  if item_record.id is null then
    raise exception using errcode = '22023', message = 'VK external item not found';
  end if;
  if item_record.status = 'ignored' then
    return item_record.id;
  end if;
  if item_record.status <> 'new' then
    raise exception using errcode = '22023', message = 'Only a new VK item can be ignored';
  end if;

  if item_record.content_candidate_id is not null then
    perform public.review_content_candidate(
      item_record.content_candidate_id,
      'reject',
      null,
      'Материал VK проигнорирован администратором.'
    );
  else
    update public.external_items
    set status = 'ignored',
        reviewed_at = now(),
        reviewed_by = actor_id,
        updated_at = now()
    where id = item_record.id;
  end if;

  return item_record.id;
end;
$$;

revoke all on function public.ignore_vk_external_item(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ignore_vk_external_item(uuid) to authenticated;

create or replace function public.sync_vk_external_item_from_candidate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and new.result_publication_id is not null then
    update public.external_items
    set status = 'imported',
        publication_id = new.result_publication_id,
        imported_at = coalesce(imported_at, now()),
        reviewed_at = coalesce(new.reviewed_at, now()),
        reviewed_by = new.reviewed_by,
        updated_at = now()
    where content_candidate_id = new.id
      and status <> 'imported';
  elsif new.status = 'rejected' then
    update public.external_items
    set status = 'ignored',
        reviewed_at = coalesce(new.reviewed_at, now()),
        reviewed_by = new.reviewed_by,
        updated_at = now()
    where content_candidate_id = new.id
      and status = 'new';
  elsif new.status = 'failed' then
    update public.external_items
    set status = 'error',
        reviewed_at = coalesce(new.reviewed_at, now()),
        reviewed_by = new.reviewed_by,
        updated_at = now()
    where content_candidate_id = new.id
      and status = 'new';
  end if;

  return new;
end;
$$;

revoke all on function public.sync_vk_external_item_from_candidate()
  from public, anon, authenticated, service_role;

drop trigger if exists sync_vk_external_item_from_candidate_trigger
  on public.content_candidates;
create trigger sync_vk_external_item_from_candidate_trigger
after update of status, result_publication_id, reviewed_at, reviewed_by
on public.content_candidates
for each row
when (
  old.status is distinct from new.status
  or old.result_publication_id is distinct from new.result_publication_id
)
execute function public.sync_vk_external_item_from_candidate();

notify pgrst, 'reload schema';
