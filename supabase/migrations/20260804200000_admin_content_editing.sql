create or replace function public.save_admin_publication(
  p_organization_id uuid,
  p_publication_id uuid,
  p_client_request_id uuid,
  p_intent text,
  p_type public.publication_type,
  p_title text,
  p_description text,
  p_category_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_valid_until timestamptz,
  p_publish_at timestamptz,
  p_place text,
  p_price_text text,
  p_is_free boolean,
  p_age_limit text,
  p_contact_phone text,
  p_schedule_entries jsonb
)
returns public.publications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_record public.publications;
  saved_record public.publications;
  normalized_title text := nullif(btrim(coalesce(p_title, '')), '');
  normalized_description text := nullif(btrim(coalesce(p_description, '')), '');
  normalized_place text := nullif(btrim(coalesce(p_place, '')), '');
  normalized_price text := nullif(btrim(coalesce(p_price_text, '')), '');
  normalized_age_limit text := nullif(btrim(coalesce(p_age_limit, '')), '');
  normalized_contact_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  normalized_schedule jsonb := coalesce(p_schedule_entries, '[]'::jsonb);
  schedule_count integer;
  requires_complete boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  if p_publication_id is null then
    raise exception using errcode = '22023', message = 'Publication id is required';
  end if;

  select publication.*
    into existing_record
  from public.publications publication
  where publication.id = p_publication_id
  for update;

  if existing_record.id is null then
    raise exception using errcode = '22023', message = 'Publication not found';
  end if;

  if existing_record.organization_id <> p_organization_id then
    raise exception using errcode = '42501', message = 'Publication does not belong to the organization';
  end if;

  if p_intent not in ('draft', 'publish', 'schedule') then
    raise exception using errcode = '22023', message = 'Unsupported publication intent';
  end if;

  if normalized_title is null or char_length(normalized_title) < 3 or char_length(normalized_title) > 180 then
    raise exception using errcode = '22023', message = 'Title must contain from 3 to 180 characters';
  end if;

  if not exists (
    select 1
    from public.publication_categories category
    where category.id = p_category_id
      and category.is_active
  ) then
    raise exception using errcode = '22023', message = 'Active publication category not found';
  end if;

  if jsonb_typeof(normalized_schedule) <> 'array' then
    raise exception using errcode = '22023', message = 'Schedule entries must be a JSON array';
  end if;

  select count(*)::integer
    into schedule_count
  from jsonb_array_elements(normalized_schedule);

  if exists (
    select 1
    from jsonb_to_recordset(normalized_schedule) as entry(
      schedule_text text,
      weekday smallint,
      starts_at time,
      ends_at time,
      sort_order integer,
      timezone text
    )
    where nullif(btrim(coalesce(entry.schedule_text, '')), '') is null
      or (entry.weekday is not null and entry.weekday not between 1 and 7)
      or (entry.starts_at is not null and entry.ends_at is not null and entry.ends_at < entry.starts_at)
      or nullif(btrim(coalesce(entry.timezone, 'Europe/Moscow')), '') is null
  ) then
    raise exception using errcode = '22023', message = 'Invalid regular schedule entry';
  end if;

  requires_complete := existing_record.status <> 'draft' or p_intent <> 'draft';

  if requires_complete then
    if normalized_description is null or char_length(normalized_description) < 10 then
      raise exception using errcode = '22023', message = 'Description must contain at least 10 characters';
    end if;

    if p_type = 'event' then
      if p_starts_at is null or p_ends_at is null or p_ends_at < p_starts_at then
        raise exception using errcode = '22023', message = 'Event start and valid end are required';
      end if;

      if normalized_place is null then
        raise exception using errcode = '22023', message = 'Event place is required';
      end if;
    else
      if p_valid_until is null or p_valid_until <= now() then
        raise exception using errcode = '22023', message = 'Publication validity date must be in the future';
      end if;
    end if;

    if p_type = 'regular' then
      if normalized_place is null then
        raise exception using errcode = '22023', message = 'Regular activity place is required';
      end if;

      if schedule_count = 0 then
        raise exception using errcode = '22023', message = 'Regular activity schedule is required';
      end if;

      if exists (
        select 1
        from jsonb_to_recordset(normalized_schedule) as entry(starts_at time)
        where entry.starts_at is null
      ) then
        raise exception using errcode = '22023', message = 'Every regular schedule entry requires a start time';
      end if;
    end if;

    if p_type in ('event', 'regular') and not p_is_free and normalized_price is null then
      raise exception using errcode = '22023', message = 'Price or free marker is required';
    end if;

    if existing_record.status = 'scheduled'
      and (p_publish_at is null or p_publish_at <= now())
    then
      raise exception using errcode = '22023', message = 'Scheduled publication time must be in the future';
    end if;
  end if;

  normalized_price := case
    when p_type not in ('event', 'promo', 'regular') then null
    when p_is_free then 'Бесплатно'
    when normalized_price is not null then normalized_price
    when p_type = 'promo' then 'Условия в описании'
    else 'Не указано'
  end;

  update public.publications
  set
    type = p_type,
    title = normalized_title,
    description = normalized_description,
    category_id = p_category_id,
    starts_at = case when p_type = 'event' then p_starts_at else null end,
    ends_at = case when p_type = 'event' then p_ends_at else null end,
    valid_until = case when p_type = 'event' then null else p_valid_until end,
    publish_at = case
      when existing_record.status = 'scheduled' then p_publish_at
      else existing_record.publish_at
    end,
    place = case when p_type in ('event', 'regular') then normalized_place else null end,
    price_text = normalized_price,
    is_free = case when p_type in ('event', 'promo', 'regular') then p_is_free else false end,
    age_limit = case when p_type in ('event', 'regular') then normalized_age_limit else null end,
    contact_phone = case when p_type = 'news' then null else normalized_contact_phone end,
    schedule_last_attempt_at = null,
    schedule_error = null,
    updated_at = now()
  where id = existing_record.id
  returning * into saved_record;

  delete from public.publication_schedules
  where publication_id = saved_record.id;

  if p_type = 'regular' and schedule_count > 0 then
    insert into public.publication_schedules (
      publication_id,
      schedule_text,
      weekday,
      starts_at,
      ends_at,
      sort_order,
      timezone
    )
    select
      saved_record.id,
      btrim(entry.schedule_text),
      entry.weekday,
      entry.starts_at,
      entry.ends_at,
      coalesce(entry.sort_order, row_number() over ()::integer - 1),
      coalesce(nullif(btrim(entry.timezone), ''), 'Europe/Moscow')
    from jsonb_to_recordset(normalized_schedule) as entry(
      schedule_text text,
      weekday smallint,
      starts_at time,
      ends_at time,
      sort_order integer,
      timezone text
    );
  end if;

  return saved_record;
end;
$$;

revoke all on function public.save_admin_publication(
  uuid, uuid, uuid, text, public.publication_type, text, text, uuid,
  timestamptz, timestamptz, timestamptz, timestamptz, text, text,
  boolean, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.save_admin_publication(
  uuid, uuid, uuid, text, public.publication_type, text, text, uuid,
  timestamptz, timestamptz, timestamptz, timestamptz, text, text,
  boolean, text, text, jsonb
) to authenticated;

comment on function public.save_admin_publication(
  uuid, uuid, uuid, text, public.publication_type, text, text, uuid,
  timestamptz, timestamptz, timestamptz, timestamptz, text, text,
  boolean, text, text, jsonb
) is 'Admin-only content editor that preserves publication status and author and replaces schedules atomically.';
