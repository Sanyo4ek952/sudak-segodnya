do $$
begin
  create type public.publication_media_kind as enum ('photo', 'video', 'clip');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_candidate_media_source as enum (
    'vk_import', 'manual_upload', 'manual_vk'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_candidate_media_status as enum ('ready', 'pending', 'error');
exception when duplicate_object then null;
end $$;

alter table public.media_assets
  drop constraint if exists media_assets_owner_matches_purpose,
  add constraint media_assets_owner_matches_purpose check (
    (purpose in ('organization_logo', 'organization_cover') and organization_id is not null)
    or (purpose = 'application_confirmation' and application_id is not null and visibility = 'private')
    or (purpose in ('publication_photo', 'publication_video_poster') and publication_id is not null)
    or (purpose = 'menu_item_photo' and menu_item_id is not null)
  ),
  drop constraint if exists media_assets_bucket_matches_purpose,
  add constraint media_assets_bucket_matches_purpose check (
    (purpose in ('organization_logo', 'organization_cover') and bucket_id = 'organization-images')
    or (purpose = 'application_confirmation' and bucket_id = 'application-confirmation-images')
    or (purpose in ('publication_photo', 'publication_video_poster') and bucket_id = 'publication-images')
    or (purpose = 'menu_item_photo' and bucket_id = 'menu-images')
  );

drop index if exists public.media_assets_one_publication_photo_idx;

create table if not exists public.content_candidate_media (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.content_candidates(id) on delete cascade,
  kind public.publication_media_kind not null,
  source_kind public.content_candidate_media_source not null,
  source_media_key text,
  bucket_id text,
  storage_path text,
  source_url text,
  embed_url text,
  external_id text,
  title text,
  duration_seconds integer,
  width integer,
  height integer,
  included boolean not null default true,
  status public.content_candidate_media_status not null default 'pending',
  error_message text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_candidate_media_source_key_not_empty check (
    source_media_key is null or nullif(btrim(source_media_key), '') is not null
  ),
  constraint content_candidate_media_storage_pair check (
    (bucket_id is null and storage_path is null)
    or (bucket_id is not null and nullif(btrim(storage_path), '') is not null)
  ),
  constraint content_candidate_media_kind_fields check (
    (
      kind = 'photo'
      and bucket_id is not null
      and embed_url is null
    )
    or kind in ('video', 'clip')
  ),
  constraint content_candidate_media_ready_fields check (
    status <> 'ready'
    or (
      bucket_id is not null
      and storage_path is not null
      and (kind = 'photo' or (source_url is not null and embed_url is not null))
    )
  ),
  constraint content_candidate_media_vk_source_url check (
    kind = 'photo' or source_url is null
    or source_url ~* '^https://(www\.)?(vk\.com|vk\.ru)/(video|clip)-?[0-9]+_[0-9]+([/?#].*)?$'
  ),
  constraint content_candidate_media_vk_embed_url check (
    embed_url is null
    or embed_url ~* '^https://(www\.)?(vk\.com|vk\.ru|vkvideo\.ru)/video_ext\.php\?'
  ),
  constraint content_candidate_media_dimensions_positive check (
    (duration_seconds is null or duration_seconds >= 0)
    and (width is null or width > 0)
    and (height is null or height > 0)
  ),
  constraint content_candidate_media_error_length check (
    error_message is null or char_length(error_message) <= 1000
  ),
  constraint content_candidate_media_sort_nonnegative check (sort_order >= 0)
);

create unique index if not exists content_candidate_media_source_key_uidx
  on public.content_candidate_media(candidate_id, source_kind, source_media_key)
  where source_media_key is not null;
create unique index if not exists content_candidate_media_order_uidx
  on public.content_candidate_media(candidate_id, sort_order);
create index if not exists content_candidate_media_candidate_idx
  on public.content_candidate_media(candidate_id, included, sort_order);

create or replace function public.enforce_candidate_media_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform 1 from public.content_candidates candidate
  where candidate.id = new.candidate_id for update;
  if new.included and (
    select count(*)
    from public.content_candidate_media media
    where media.candidate_id = new.candidate_id
      and media.included
      and media.id <> new.id
  ) >= 10 then
    raise exception using errcode = '23514', message = 'A candidate can include at most 10 media items';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_candidate_media_limit_trigger on public.content_candidate_media;
create trigger enforce_candidate_media_limit_trigger
before insert or update of candidate_id, included on public.content_candidate_media
for each row execute function public.enforce_candidate_media_limit();

create or replace function public.touch_content_candidate_from_media()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_candidate_id uuid;
begin
  target_candidate_id := case when tg_op = 'DELETE' then old.candidate_id else new.candidate_id end;
  update public.content_candidates
  set updated_at = now()
  where id = target_candidate_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists set_content_candidate_media_updated_at on public.content_candidate_media;
create trigger set_content_candidate_media_updated_at
before update on public.content_candidate_media
for each row execute function public.set_updated_at();

drop trigger if exists touch_candidate_after_media_change on public.content_candidate_media;
create trigger touch_candidate_after_media_change
after insert or update or delete on public.content_candidate_media
for each row execute function public.touch_content_candidate_from_media();

create table if not exists public.publication_media (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  kind public.publication_media_kind not null,
  provider text,
  external_id text,
  source_url text,
  embed_url text,
  title text,
  duration_seconds integer,
  width integer,
  height integer,
  sort_order integer not null,
  source_candidate_media_id uuid references public.content_candidate_media(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_media_asset_uidx unique (media_asset_id),
  constraint publication_media_order_unique unique (publication_id, sort_order)
    deferrable initially immediate,
  constraint publication_media_candidate_uidx unique (source_candidate_media_id),
  constraint publication_media_sort_range check (sort_order between 0 and 9),
  constraint publication_media_kind_fields check (
    (
      kind = 'photo'
      and provider is null
      and embed_url is null
    )
    or (
      kind in ('video', 'clip')
      and provider = 'vk'
      and source_url is not null
      and embed_url is not null
    )
  ),
  constraint publication_media_vk_source_url check (
    kind = 'photo'
    or source_url ~* '^https://(www\.)?(vk\.com|vk\.ru)/(video|clip)-?[0-9]+_[0-9]+([/?#].*)?$'
  ),
  constraint publication_media_vk_embed_url check (
    embed_url is null
    or embed_url ~* '^https://(www\.)?(vk\.com|vk\.ru|vkvideo\.ru)/video_ext\.php\?'
  ),
  constraint publication_media_dimensions_positive check (
    (duration_seconds is null or duration_seconds >= 0)
    and (width is null or width > 0)
    and (height is null or height > 0)
  )
);

create index if not exists publication_media_publication_idx
  on public.publication_media(publication_id, sort_order);

create or replace function public.validate_publication_media_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  asset public.media_assets;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.publication_id::text, 0));
  select * into asset from public.media_assets where id = new.media_asset_id;
  if asset.id is null
    or asset.publication_id <> new.publication_id
    or asset.deleted_at is not null
    or asset.bucket_id <> 'publication-images'
    or (new.kind = 'photo' and asset.purpose <> 'publication_photo')
    or (new.kind in ('video', 'clip') and asset.purpose <> 'publication_video_poster') then
    raise exception using errcode = '23514', message = 'Media asset does not belong to this publication or has an invalid purpose';
  end if;

  if tg_op = 'INSERT' and (
    select count(*) from public.publication_media media
    where media.publication_id = new.publication_id
  ) >= 10 then
    raise exception using errcode = '23514', message = 'A publication can contain at most 10 media items';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_publication_media_row_trigger on public.publication_media;
create trigger validate_publication_media_row_trigger
before insert or update on public.publication_media
for each row execute function public.validate_publication_media_row();

drop trigger if exists set_publication_media_updated_at on public.publication_media;
create trigger set_publication_media_updated_at
before update on public.publication_media
for each row execute function public.set_updated_at();

create or replace function public.link_legacy_publication_photo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare next_order integer;
begin
  if new.publication_id is null or new.purpose <> 'publication_photo' or new.deleted_at is not null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.publication_id::text, 0));
  if exists (select 1 from public.publication_media where media_asset_id = new.id) then return new; end if;
  select count(*) into next_order from public.publication_media where publication_id = new.publication_id;
  if next_order < 10 then
    insert into public.publication_media (
      publication_id, media_asset_id, kind, width, height, sort_order
    ) values (
      new.publication_id, new.id, 'photo', new.width, new.height, next_order
    );
  end if;
  return new;
end;
$$;

drop trigger if exists link_legacy_publication_photo_trigger on public.media_assets;
create trigger link_legacy_publication_photo_trigger
after insert on public.media_assets
for each row execute function public.link_legacy_publication_photo();

create or replace function public.unlink_deleted_publication_asset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null and new.publication_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.publication_id::text, 0));
    delete from public.publication_media where media_asset_id = new.id;
    update public.publication_media media
    set sort_order = normalized.sort_order
    from (
      select id, row_number() over (order by sort_order, id) - 1 as sort_order
      from public.publication_media where publication_id = new.publication_id
    ) normalized
    where media.id = normalized.id;
  end if;
  return new;
end;
$$;

drop trigger if exists unlink_deleted_publication_asset_trigger on public.media_assets;
create trigger unlink_deleted_publication_asset_trigger
after update of deleted_at on public.media_assets
for each row execute function public.unlink_deleted_publication_asset();

insert into public.publication_media (
  publication_id, media_asset_id, kind, sort_order, width, height
)
select
  asset.publication_id,
  asset.id,
  'photo'::public.publication_media_kind,
  row_number() over (partition by asset.publication_id order by asset.sort_order, asset.created_at, asset.id) - 1,
  asset.width,
  asset.height
from public.media_assets asset
where asset.publication_id is not null
  and asset.purpose = 'publication_photo'
  and asset.deleted_at is null
on conflict (media_asset_id) do nothing;

alter table public.content_candidate_media enable row level security;
alter table public.publication_media enable row level security;

create policy "Admins can manage candidate media"
on public.content_candidate_media
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read media for public publications"
on public.publication_media
for select to anon, authenticated
using (
  exists (
    select 1
    from public.publications publication
    join public.media_assets asset on asset.id = publication_media.media_asset_id
    where publication.id = publication_media.publication_id
      and public.is_public_publication(publication)
      and asset.deleted_at is null
  )
  or exists (
    select 1 from public.publications publication
    where publication.id = publication_media.publication_id
      and (public.is_admin() or public.is_org_member(publication.organization_id))
  )
);

create or replace function public.can_manage_publication_media(target_publication_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.publications publication
    where publication.id = target_publication_id
      and public.is_org_member(publication.organization_id)
  );
$$;

create or replace function public.append_publication_media(
  target_publication_id uuid,
  target_media_asset_id uuid,
  media_kind public.publication_media_kind,
  media_provider text default null,
  media_external_id text default null,
  media_source_url text default null,
  media_embed_url text default null,
  media_title text default null,
  media_duration_seconds integer default null,
  media_width integer default null,
  media_height integer default null,
  candidate_media_id uuid default null
)
returns public.publication_media
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_order integer;
  inserted public.publication_media;
begin
  if auth.uid() is null or not public.can_manage_publication_media(target_publication_id) then
    raise exception using errcode = '42501', message = 'Publication media access denied';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_publication_id::text, 0));
  select count(*) into next_order
  from public.publication_media where publication_id = target_publication_id;
  if next_order >= 10 then
    raise exception using errcode = '23514', message = 'A publication can contain at most 10 media items';
  end if;

  insert into public.publication_media (
    publication_id, media_asset_id, kind, provider, external_id, source_url,
    embed_url, title, duration_seconds, width, height, sort_order,
    source_candidate_media_id
  ) values (
    target_publication_id, target_media_asset_id, media_kind, media_provider,
    media_external_id, media_source_url, media_embed_url, media_title,
    media_duration_seconds, media_width, media_height, next_order,
    candidate_media_id
  )
  on conflict (source_candidate_media_id) do update
  set updated_at = publication_media.updated_at
  returning * into inserted;
  return inserted;
end;
$$;

create or replace function public.reorder_publication_media(
  target_publication_id uuid,
  ordered_media_ids uuid[]
)
returns setof public.publication_media
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
begin
  if auth.uid() is null or not public.can_manage_publication_media(target_publication_id) then
    raise exception using errcode = '42501', message = 'Publication media access denied';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_publication_id::text, 0));
  select count(*) into current_count from public.publication_media where publication_id = target_publication_id;
  if coalesce(array_length(ordered_media_ids, 1), 0) <> current_count
    or (select count(distinct id) from unnest(ordered_media_ids) id) <> current_count
    or exists (
      select 1 from unnest(ordered_media_ids) id
      where not exists (
        select 1 from public.publication_media media
        where media.id = id and media.publication_id = target_publication_id
      )
    ) then
    raise exception using errcode = '22023', message = 'Ordered media ids must contain every publication media item exactly once';
  end if;

  set constraints publication_media_order_unique deferred;
  update public.publication_media media
  set sort_order = ordered.ordinality - 1
  from unnest(ordered_media_ids) with ordinality ordered(id, ordinality)
  where media.id = ordered.id and media.publication_id = target_publication_id;
  return query select * from public.publication_media
    where publication_id = target_publication_id order by sort_order;
end;
$$;

create or replace function public.remove_publication_media(target_media_id uuid)
returns table(bucket_id text, storage_path text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.publication_media;
begin
  select * into target from public.publication_media where id = target_media_id for update;
  if target.id is null then return; end if;
  if auth.uid() is null or not public.can_manage_publication_media(target.publication_id) then
    raise exception using errcode = '42501', message = 'Publication media access denied';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target.publication_id::text, 0));
  delete from public.publication_media where id = target.id;
  update public.media_assets asset
  set deleted_at = now()
  where asset.id = target.media_asset_id
  returning asset.bucket_id, asset.storage_path into bucket_id, storage_path;
  update public.publication_media media
  set sort_order = normalized.sort_order
  from (
    select id, row_number() over (order by sort_order, id) - 1 as sort_order
    from public.publication_media where publication_id = target.publication_id
  ) normalized
  where media.id = normalized.id;
  return next;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-candidate-media', 'content-candidate-media', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can manage candidate media storage"
on storage.objects
for all to authenticated
using (bucket_id = 'content-candidate-media' and public.is_admin())
with check (bucket_id = 'content-candidate-media' and public.is_admin());

create or replace function public.purge_expired_content_candidate_media()
returns table(bucket_id text, storage_path text)
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.content_candidate_media media
  using public.content_candidates candidate
  where candidate.id = media.candidate_id
    and candidate.status in ('approved', 'rejected', 'stale', 'failed')
    and candidate.raw_expires_at <= now()
    and media.bucket_id is not null
    and media.storage_path is not null
  returning media.bucket_id, media.storage_path;
$$;

revoke all on table public.content_candidate_media from anon;
revoke all on table public.publication_media from anon, authenticated;
grant select on table public.content_candidate_media to authenticated;
grant select on table public.publication_media to anon, authenticated;
revoke all on function public.can_manage_publication_media(uuid) from public, anon;
revoke all on function public.append_publication_media(
  uuid, uuid, public.publication_media_kind, text, text, text, text, text,
  integer, integer, integer, uuid
) from public, anon;
revoke all on function public.reorder_publication_media(uuid, uuid[]) from public, anon;
revoke all on function public.remove_publication_media(uuid) from public, anon;
grant execute on function public.can_manage_publication_media(uuid) to authenticated;
grant execute on function public.append_publication_media(
  uuid, uuid, public.publication_media_kind, text, text, text, text, text,
  integer, integer, integer, uuid
) to authenticated;
grant execute on function public.reorder_publication_media(uuid, uuid[]) to authenticated;
grant execute on function public.remove_publication_media(uuid) to authenticated;
revoke all on function public.purge_expired_content_candidate_media() from public, anon, authenticated;
grant execute on function public.purge_expired_content_candidate_media() to service_role;
