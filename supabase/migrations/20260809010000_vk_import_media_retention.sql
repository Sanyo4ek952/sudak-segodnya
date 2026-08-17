-- Retain VK photos and video previews in a private staging bucket. Imported
-- news remains eligible for review for the same seven-day window enforced by
-- the generic content-ingestion workflow.

create table public.external_item_media (
  id uuid primary key default gen_random_uuid(),
  external_item_id uuid not null references public.external_items(id) on delete cascade,
  media_key text not null,
  kind text not null,
  source_url text not null,
  bucket_id text not null default 'vk-import-media',
  storage_path text not null,
  width integer,
  height integer,
  mime_type text not null,
  size_bytes bigint not null,
  content_hash text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_item_media_key_format check (
    nullif(btrim(media_key), '') is not null and char_length(media_key) <= 300
  ),
  constraint external_item_media_kind check (kind in ('photo', 'video_preview')),
  constraint external_item_media_source_url check (
    lower(source_url) like 'https://%' and char_length(source_url) <= 2000
  ),
  constraint external_item_media_bucket check (bucket_id = 'vk-import-media'),
  constraint external_item_media_storage_path check (
    nullif(btrim(storage_path), '') is not null and char_length(storage_path) <= 1000
  ),
  constraint external_item_media_mime_type check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint external_item_media_size check (size_bytes > 0 and size_bytes <= 5242880),
  constraint external_item_media_dimensions check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint external_item_media_content_hash check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint external_item_media_sort_order check (sort_order >= 0),
  constraint external_item_media_item_key_unique unique (external_item_id, media_key),
  constraint external_item_media_storage_unique unique (bucket_id, storage_path)
);

create index external_item_media_item_order_idx
  on public.external_item_media(external_item_id, sort_order, id);

drop trigger if exists set_external_item_media_updated_at on public.external_item_media;
create trigger set_external_item_media_updated_at
before update on public.external_item_media
for each row execute function public.set_updated_at();

alter table public.external_item_media enable row level security;

create policy "Admins can read external item media"
on public.external_item_media for select to authenticated
using (public.is_admin());

revoke all on table public.external_item_media from public, anon, authenticated;
grant select on table public.external_item_media to authenticated;
grant select, insert, update, delete on table public.external_item_media to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vk-import-media',
  'vk-import-media',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
  if item_record.published_at + interval '7 days' <= now() then
    raise exception using errcode = '22023', message = 'VK external item is stale';
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

  select case
      when media_item ->> 'type' = 'photo' then media_item ->> 'sourceUrl'
      when media_item ->> 'type' = 'video' then media_item ->> 'previewSourceUrl'
      else null
    end
    into primary_image_url
  from jsonb_array_elements(item_record.media) with ordinality media(media_item, position)
  where media_item ->> 'type' in ('photo', 'video')
    and lower(coalesce(
      case
        when media_item ->> 'type' = 'photo' then media_item ->> 'sourceUrl'
        else media_item ->> 'previewSourceUrl'
      end,
      ''
    )) like 'https://%'
    and char_length(coalesce(
      case
        when media_item ->> 'type' = 'photo' then media_item ->> 'sourceUrl'
        else media_item ->> 'previewSourceUrl'
      end,
      ''
    )) <= 2000
  order by
    case when media_item ->> 'type' = 'photo' then 0 else 1 end,
    coalesce((media_item ->> 'width')::integer, 0)
      * coalesce((media_item ->> 'height')::integer, 0) desc,
    position
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
  if exists (
    select 1
    from jsonb_array_elements(item_record.media) media_item
    where media_item ->> 'type' = 'video'
  ) then
    candidate_warnings := candidate_warnings || jsonb_build_array(
      'Видео остаётся в VK; для публикации используется сохранённый постер видео.'
    );
  end if;
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

notify pgrst, 'reload schema';
