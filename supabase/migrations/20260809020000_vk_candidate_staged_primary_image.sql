-- Prefer retained VK media when preparing a publication candidate. This also
-- covers legacy external_items rows whose media JSON predates media staging.

create or replace function public.set_vk_candidate_staged_primary_image()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  staged_source_url text;
begin
  if new.action not in ('create_publication', 'update_publication')
    or coalesce(new.external_id, '') not like 'vk:%'
  then
    return new;
  end if;

  select media.source_url
    into staged_source_url
  from public.external_items item
  join public.external_item_media media
    on media.external_item_id = item.id
  where new.external_id = 'vk:' || item.source_id::text || ':' || item.external_id
    and new.source_url = item.source_url
  order by
    case when media.kind = 'photo' then 0 else 1 end,
    coalesce(media.width, 0)::bigint * coalesce(media.height, 0)::bigint desc,
    media.sort_order,
    media.id
  limit 1;

  if staged_source_url is not null then
    new.payload := jsonb_set(
      new.payload,
      '{imageSourceUrl}',
      to_jsonb(staged_source_url),
      true
    );
  end if;

  return new;
end;
$$;

revoke all on function public.set_vk_candidate_staged_primary_image()
  from public, anon, authenticated, service_role;

drop trigger if exists set_vk_candidate_staged_primary_image_trigger
  on public.content_candidates;
create trigger set_vk_candidate_staged_primary_image_trigger
before insert on public.content_candidates
for each row execute function public.set_vk_candidate_staged_primary_image();

-- Repair pending VK candidates if the migration is applied after they were
-- prepared but before an administrator reviewed them.
with primary_media as (
  select distinct on (candidate.id)
    candidate.id as candidate_id,
    media.source_url
  from public.content_candidates candidate
  join public.external_items item
    on candidate.external_id = 'vk:' || item.source_id::text || ':' || item.external_id
   and candidate.source_url = item.source_url
  join public.external_item_media media
    on media.external_item_id = item.id
  where candidate.status = 'pending'
    and candidate.action in ('create_publication', 'update_publication')
  order by
    candidate.id,
    case when media.kind = 'photo' then 0 else 1 end,
    coalesce(media.width, 0)::bigint * coalesce(media.height, 0)::bigint desc,
    media.sort_order,
    media.id
)
update public.content_candidates candidate
set payload = jsonb_set(
      candidate.payload,
      '{imageSourceUrl}',
      to_jsonb(primary_media.source_url),
      true
    ),
    updated_at = now()
from primary_media
where candidate.id = primary_media.candidate_id;

notify pgrst, 'reload schema';
