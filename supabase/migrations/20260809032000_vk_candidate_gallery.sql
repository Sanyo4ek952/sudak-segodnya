create or replace function public.populate_vk_candidate_media()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  external_item_record public.external_items;
  media_record record;
  staged_record public.external_item_media;
  media_kind public.publication_media_kind;
  media_status public.content_candidate_media_status;
  ready_count integer := 0;
  media_key text;
  source_link text;
  player_link text;
begin
  if new.action not in ('create_publication', 'update_publication') then return new; end if;
  select item.* into external_item_record
  from public.external_items item
  where item.source_url = new.source_url
  order by item.created_at desc
  limit 1;
  if external_item_record.id is null or jsonb_typeof(external_item_record.media) <> 'array' then
    return new;
  end if;

  for media_record in
    select value as media, ordinality - 1 as source_order
    from jsonb_array_elements(external_item_record.media) with ordinality
  loop
    if media_record.media ->> 'type' = 'photo' then
      media_kind := 'photo';
      media_key := 'photo:' || coalesce(nullif(media_record.media ->> 'externalId', ''), media_record.source_order::text);
    elsif media_record.media ->> 'type' = 'video' then
      media_kind := case when media_record.media ->> 'attachmentType' = 'clip'
        then 'clip'::public.publication_media_kind
        else 'video'::public.publication_media_kind end;
      media_key := 'video:' || coalesce(nullif(media_record.media ->> 'externalId', ''), media_record.source_order::text);
    else
      continue;
    end if;

    select staged.* into staged_record
    from public.external_item_media staged
    where staged.external_item_id = external_item_record.id
      and staged.media_key = media_key
    limit 1;
    source_link := case when media_kind = 'photo'
      then null
      else nullif(media_record.media ->> 'sourceUrl', '') end;
    player_link := case when media_kind = 'photo'
      then null
      else nullif(media_record.media ->> 'embedUrl', '') end;
    media_status := case
      when staged_record.id is null then 'error'::public.content_candidate_media_status
      when media_kind = 'photo' then 'ready'::public.content_candidate_media_status
      when nullif(media_record.media ->> 'resolveError', '') is not null then 'error'::public.content_candidate_media_status
      when player_link is not null then 'ready'::public.content_candidate_media_status
      else 'pending'::public.content_candidate_media_status
    end;

    insert into public.content_candidate_media (
      candidate_id, kind, source_kind, source_media_key, bucket_id, storage_path,
      source_url, embed_url, external_id, title, duration_seconds, width, height,
      included, status, error_message, sort_order
    ) values (
      new.id, media_kind, 'vk_import', media_key, staged_record.bucket_id,
      staged_record.storage_path, source_link, player_link,
      nullif(media_record.media ->> 'externalId', ''),
      nullif(media_record.media ->> 'title', ''),
      case when media_record.media ->> 'durationSeconds' ~ '^[0-9]+$'
        then (media_record.media ->> 'durationSeconds')::integer else null end,
      coalesce(staged_record.width, case when media_record.media ->> 'width' ~ '^[1-9][0-9]*$'
        then (media_record.media ->> 'width')::integer else null end),
      coalesce(staged_record.height, case when media_record.media ->> 'height' ~ '^[1-9][0-9]*$'
        then (media_record.media ->> 'height')::integer else null end),
      media_status = 'ready' and ready_count < 10,
      media_status,
      case
        when staged_record.id is null then 'Не удалось подготовить изображение.'
        when nullif(media_record.media ->> 'resolveError', '') is not null
          then left(media_record.media ->> 'resolveError', 1000)
        when media_kind <> 'photo' and player_link is null then 'VK-плеер ожидает подготовки.'
        else null
      end,
      media_record.source_order
    )
    on conflict (candidate_id, source_kind, source_media_key)
      where source_media_key is not null do nothing;
    if media_status = 'ready' and ready_count < 10 then ready_count := ready_count + 1; end if;
    staged_record := null;
  end loop;
  return new;
end;
$$;

drop trigger if exists populate_vk_candidate_media_trigger on public.content_candidates;
create trigger populate_vk_candidate_media_trigger
after insert on public.content_candidates
for each row execute function public.populate_vk_candidate_media();

-- Historical approved candidates are intentionally excluded: old VK videos are
-- not reconstructed after publication. New candidates are populated by the trigger.
