-- Secure publication workflow, scheduling and type-specific database guarantees.
-- This migration intentionally keeps direct member DML limited to drafts. Publishing
-- and changes to public records are performed by narrowly scoped SECURITY DEFINER RPCs.

alter table public.publications
  add column if not exists publish_at timestamptz,
  add column if not exists client_request_id uuid,
  add column if not exists schedule_last_attempt_at timestamptz,
  add column if not exists schedule_error text;

alter table public.publication_schedules
  add column if not exists timezone text not null default 'Europe/Moscow';

-- Legacy "scheduled" records had no execution time and therefore were not truly
-- scheduled. Preserve their content as drafts instead of publishing unpredictably.
update public.publications
set status = 'draft',
    publish_at = null,
    updated_at = now()
where status = 'scheduled'
  and publish_at is null;

alter table public.publications
  drop constraint if exists publications_publish_at_matches_status,
  add constraint publications_publish_at_matches_status check (
    (status = 'scheduled' and publish_at is not null)
    or (status <> 'scheduled' and publish_at is null)
  ),
  drop constraint if exists publications_public_status_has_required_fields,
  add constraint publications_public_status_has_required_fields check (
    status not in ('scheduled', 'published', 'cancelled')
    or (
      category_id is not null
      and nullif(btrim(coalesce(description, '')), '') is not null
      and nullif(btrim(coalesce(price_text, '')), '') is not null
      and (
        (
          type = 'event'
          and starts_at is not null
          and ends_at is not null
          and nullif(btrim(coalesce(place, '')), '') is not null
        )
        or (
          type = 'regular'
          and valid_until is not null
          and nullif(btrim(coalesce(place, '')), '') is not null
        )
        or (
          type in ('announcement', 'promo', 'news')
          and valid_until is not null
        )
      )
    )
  ) not valid;

-- Do not invent missing business data for legacy public rows. Keep the records for
-- history, but remove incomplete material from public circulation before validating
-- the strict invariant.
update public.publications
set status = 'completed',
    completed_at = coalesce(completed_at, now()),
    publish_at = null,
    updated_at = now()
where status in ('scheduled', 'published', 'cancelled')
  and (
    category_id is null
    or nullif(btrim(coalesce(description, '')), '') is null
    or nullif(btrim(coalesce(price_text, '')), '') is null
    or (
      type = 'event'
      and (
        starts_at is null
        or ends_at is null
        or nullif(btrim(coalesce(place, '')), '') is null
      )
    )
    or (
      type = 'regular'
      and (
        valid_until is null
        or nullif(btrim(coalesce(place, '')), '') is null
      )
    )
    or (
      type in ('announcement', 'promo', 'news')
      and valid_until is null
    )
  );

alter table public.publications
  validate constraint publications_public_status_has_required_fields;

create unique index if not exists publications_client_request_unique_idx
  on public.publications(organization_id, client_request_id)
  where client_request_id is not null;

create index if not exists publications_scheduled_due_idx
  on public.publications(publish_at, id)
  where status = 'scheduled';

create index if not exists publication_schedules_day_time_idx
  on public.publication_schedules(weekday, starts_at, publication_id)
  where weekday is not null;

create or replace function public.is_public_publication(publication_row public.publications)
returns boolean
language sql
stable
set search_path = public
as $$
  select publication_row.status in ('published', 'cancelled')
    and publication_row.published_at is not null
    and exists (
      select 1
      from public.organizations organization_record
      where organization_record.id = publication_row.organization_id
        and organization_record.status = 'active'
    )
    and (
      (
        publication_row.type = 'event'
        and coalesce(publication_row.ends_at, publication_row.starts_at) >= now()
      )
      or (
        publication_row.type in ('announcement', 'promo', 'regular', 'news')
        and publication_row.valid_until >= now()
      )
    );
$$;

create or replace function public.protect_publication_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.author_id <> auth.uid() then
        raise exception 'Cannot create a publication for another author';
      end if;

      if new.status <> 'draft' then
        raise exception 'Only the publication RPC can set a non-draft status';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.author_id <> old.author_id
        or new.organization_id <> old.organization_id
      then
        raise exception 'Cannot change publication ownership fields';
      end if;

      if old.status <> 'draft' or new.status <> 'draft' then
        raise exception 'Only the publication RPC can change a public publication';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists "Members can insert organization publications" on public.publications;
create policy "Members can insert organization publication drafts"
on public.publications
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and author_id = auth.uid()
  and status = 'draft'
);

drop policy if exists "Members can update organization publications" on public.publications;
create policy "Members can update organization publication drafts"
on public.publications
for update
to authenticated
using (
  public.is_admin()
  or (
    public.is_org_member(organization_id)
    and status = 'draft'
  )
)
with check (
  public.is_admin()
  or (
    public.is_org_member(organization_id)
    and author_id = auth.uid()
    and status = 'draft'
  )
);

drop policy if exists "Members can manage publication schedules" on public.publication_schedules;
create policy "Members can read organization publication schedules"
on public.publication_schedules
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.publications publication
    where publication.id = publication_id
      and public.is_org_member(publication.organization_id)
  )
);

create or replace function public.save_member_publication(
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
  actor_id uuid := auth.uid();
  existing_record public.publications;
  saved_record public.publications;
  target_status public.publication_status;
  normalized_title text := nullif(btrim(coalesce(p_title, '')), '');
  normalized_description text := nullif(btrim(coalesce(p_description, '')), '');
  normalized_place text := nullif(btrim(coalesce(p_place, '')), '');
  normalized_price text := nullif(btrim(coalesce(p_price_text, '')), '');
  normalized_age_limit text := nullif(btrim(coalesce(p_age_limit, '')), '');
  normalized_contact_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  normalized_schedule jsonb := coalesce(p_schedule_entries, '[]'::jsonb);
  category_slug_value text;
  schedule_count integer;
  generated_id uuid;
  generated_slug text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_intent not in ('draft', 'publish', 'schedule') then
    raise exception using errcode = '22023', message = 'Unsupported publication intent';
  end if;

  if normalized_title is null or char_length(normalized_title) < 3 or char_length(normalized_title) > 180 then
    raise exception using errcode = '22023', message = 'Title must contain from 3 to 180 characters';
  end if;

  if p_category_id is null then
    raise exception using errcode = '22023', message = 'Publication category is required';
  end if;

  select category.slug
    into category_slug_value
  from public.publication_categories category
  where category.id = p_category_id
    and category.is_active;

  if category_slug_value is null then
    raise exception using errcode = '22023', message = 'Active publication category not found';
  end if;

  if not exists (
    select 1
    from public.organization_members member_record
    join public.organizations organization_record
      on organization_record.id = member_record.organization_id
    where member_record.organization_id = p_organization_id
      and member_record.user_id = actor_id
      and member_record.is_active
      and organization_record.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Active organization membership required';
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

  if p_intent <> 'draft' then
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
    elsif p_type = 'regular' then
      if p_valid_until is null or p_valid_until <= now() then
        raise exception using errcode = '22023', message = 'Regular activity validity date must be in the future';
      end if;
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
    elsif p_type in ('announcement', 'promo', 'news') then
      if p_valid_until is null or p_valid_until <= now() then
        raise exception using errcode = '22023', message = 'Publication validity date must be in the future';
      end if;
    end if;

    if p_type in ('event', 'regular') and not p_is_free and normalized_price is null then
      raise exception using errcode = '22023', message = 'Price or free marker is required';
    end if;

    if p_intent = 'schedule' and (p_publish_at is null or p_publish_at <= now()) then
      raise exception using errcode = '22023', message = 'Scheduled publication time must be in the future';
    end if;
  end if;

  normalized_price := case
    when p_is_free then 'Бесплатно'
    when normalized_price is not null then normalized_price
    when p_type = 'news' then 'Не применяется'
    when p_type = 'promo' then 'Условия в описании'
    else 'Не указано'
  end;

  target_status := case p_intent
    when 'draft' then 'draft'::public.publication_status
    when 'schedule' then 'scheduled'::public.publication_status
    else 'published'::public.publication_status
  end;

  if p_publication_id is not null then
    select publication.*
      into existing_record
    from public.publications publication
    where publication.id = p_publication_id
    for update;

    if existing_record.id is not null
      and existing_record.organization_id <> p_organization_id
    then
      raise exception using errcode = '42501', message = 'Publication does not belong to the organization';
    end if;
  end if;

  if existing_record.id is not null then
    if existing_record.status in ('cancelled', 'completed', 'hidden', 'blocked') then
      raise exception using errcode = '22023', message = 'Publication cannot be edited in its current status';
    end if;

    if existing_record.status = 'published' and target_status = 'draft' then
      raise exception using errcode = '22023', message = 'A published publication cannot become a draft';
    end if;

    update public.publications
    set
      type = p_type,
      status = target_status,
      title = normalized_title,
      description = normalized_description,
      category_id = p_category_id,
      starts_at = case when p_type = 'event' then p_starts_at else null end,
      ends_at = case when p_type = 'event' then p_ends_at else null end,
      valid_until = case when p_type = 'event' then null else p_valid_until end,
      publish_at = case when target_status = 'scheduled' then p_publish_at else null end,
      published_at = case
        when target_status = 'published' then coalesce(existing_record.published_at, now())
        else existing_record.published_at
      end,
      sort_published_at = case
        when target_status = 'published' then coalesce(existing_record.sort_published_at, existing_record.published_at, now())
        else existing_record.sort_published_at
      end,
      place = normalized_place,
      price_text = normalized_price,
      is_free = p_is_free,
      age_limit = normalized_age_limit,
      contact_phone = normalized_contact_phone,
      schedule_last_attempt_at = null,
      schedule_error = null,
      updated_at = now()
    where id = existing_record.id
    returning * into saved_record;
  else
    generated_id := coalesce(p_publication_id, gen_random_uuid());

    if p_client_request_id is not null then
      select publication.*
        into existing_record
      from public.publications publication
      where publication.organization_id = p_organization_id
        and publication.client_request_id = p_client_request_id
      for update;

      if existing_record.id is not null then
        return existing_record;
      end if;
    end if;

    generated_slug := regexp_replace(
      lower(normalized_title),
      '[^a-zа-яё0-9]+',
      '-',
      'gi'
    );
    generated_slug := trim(both '-' from left(generated_slug, 48));
    generated_slug := coalesce(nullif(generated_slug, ''), 'publication')
      || '-' || left(replace(generated_id::text, '-', ''), 10);

    insert into public.publications (
      id,
      organization_id,
      author_id,
      client_request_id,
      slug,
      type,
      status,
      title,
      description,
      category_id,
      starts_at,
      ends_at,
      valid_until,
      publish_at,
      published_at,
      sort_published_at,
      place,
      price_text,
      is_free,
      age_limit,
      contact_phone
    )
    values (
      generated_id,
      p_organization_id,
      actor_id,
      p_client_request_id,
      generated_slug,
      p_type,
      target_status,
      normalized_title,
      normalized_description,
      p_category_id,
      case when p_type = 'event' then p_starts_at else null end,
      case when p_type = 'event' then p_ends_at else null end,
      case when p_type = 'event' then null else p_valid_until end,
      case when target_status = 'scheduled' then p_publish_at else null end,
      case when target_status = 'published' then now() else null end,
      case when target_status = 'published' then now() else null end,
      normalized_place,
      normalized_price,
      p_is_free,
      normalized_age_limit,
      normalized_contact_phone
    )
    returning * into saved_record;
  end if;

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
exception
  when unique_violation then
    if p_client_request_id is not null then
      select publication.*
        into saved_record
      from public.publications publication
      where publication.organization_id = p_organization_id
        and publication.client_request_id = p_client_request_id;

      if saved_record.id is not null then
        return saved_record;
      end if;
    end if;
    raise;
end;
$$;

revoke all on function public.save_member_publication(
  uuid, uuid, uuid, text, public.publication_type, text, text, uuid,
  timestamptz, timestamptz, timestamptz, timestamptz, text, text,
  boolean, text, text, jsonb
) from public, anon;
grant execute on function public.save_member_publication(
  uuid, uuid, uuid, text, public.publication_type, text, text, uuid,
  timestamptz, timestamptz, timestamptz, timestamptz, text, text,
  boolean, text, text, jsonb
) to authenticated;

create or replace function public.transition_member_publication(
  p_publication_id uuid,
  p_transition text
)
returns public.publications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  current_record public.publications;
  saved_record public.publications;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select publication.*
    into current_record
  from public.publications publication
  join public.organization_members member_record
    on member_record.organization_id = publication.organization_id
   and member_record.user_id = actor_id
   and member_record.is_active
  join public.organizations organization_record
    on organization_record.id = publication.organization_id
   and organization_record.status = 'active'
  where publication.id = p_publication_id
  for update of publication;

  if current_record.id is null then
    raise exception using errcode = '42501', message = 'Publication access denied';
  end if;

  if p_transition = 'cancel' and current_record.status = 'published' then
    update public.publications
    set status = 'cancelled',
        cancelled_at = now(),
        publish_at = null,
        updated_at = now()
    where id = current_record.id
    returning * into saved_record;
  elsif p_transition = 'complete' and current_record.status in ('published', 'cancelled') then
    update public.publications
    set status = 'completed',
        completed_at = now(),
        publish_at = null,
        updated_at = now()
    where id = current_record.id
    returning * into saved_record;
  else
    raise exception using errcode = '22023', message = 'Invalid publication transition';
  end if;

  return saved_record;
end;
$$;

revoke all on function public.transition_member_publication(uuid, text) from public, anon;
grant execute on function public.transition_member_publication(uuid, text) to authenticated;

create or replace function public.publish_due_publications(p_batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  published_count integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 1000 then
    raise exception using errcode = '22023', message = 'Batch size must be between 1 and 1000';
  end if;

  with due as (
    select publication.id
    from public.publications publication
    join public.organizations organization_record
      on organization_record.id = publication.organization_id
    where publication.status = 'scheduled'
      and publication.publish_at <= now()
      and organization_record.status = 'active'
    order by publication.publish_at, publication.id
    for update of publication skip locked
    limit p_batch_size
  ),
  changed as (
    update public.publications publication
    set status = 'published',
        published_at = now(),
        sort_published_at = now(),
        publish_at = null,
        schedule_last_attempt_at = now(),
        schedule_error = null,
        updated_at = now()
    from due
    where publication.id = due.id
    returning publication.id
  )
  select count(*)::integer into published_count from changed;

  update public.publications publication
  set schedule_last_attempt_at = now(),
      schedule_error = 'Организация не активна',
      updated_at = now()
  where publication.status = 'scheduled'
    and publication.publish_at <= now()
    and exists (
      select 1
      from public.organizations organization_record
      where organization_record.id = publication.organization_id
        and organization_record.status <> 'active'
    );

  return published_count;
end;
$$;

revoke all on function public.publish_due_publications(integer) from public, anon, authenticated;
grant execute on function public.publish_due_publications(integer) to service_role;

create or replace function public.complete_expired_publications(p_batch_size integer default 500)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  completed_count integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 5000 then
    raise exception using errcode = '22023', message = 'Batch size must be between 1 and 5000';
  end if;

  with expired as (
    select publication.id
    from public.publications publication
    where publication.status in ('published', 'cancelled')
      and (
        (publication.type = 'event' and coalesce(publication.ends_at, publication.starts_at) < now())
        or (
          publication.type in ('announcement', 'promo', 'regular', 'news')
          and publication.valid_until < now()
        )
      )
    order by coalesce(publication.ends_at, publication.valid_until), publication.id
    for update skip locked
    limit p_batch_size
  ),
  changed as (
    update public.publications publication
    set status = 'completed',
        completed_at = now(),
        updated_at = now()
    from expired
    where publication.id = expired.id
    returning publication.id
  )
  select count(*)::integer into completed_count from changed;

  return completed_count;
end;
$$;

revoke all on function public.complete_expired_publications(integer) from public, anon, authenticated;
grant execute on function public.complete_expired_publications(integer) to service_role;

create extension if not exists pg_cron;

do $$
declare
  existing_job_id bigint;
begin
  if to_regclass('cron.job') is not null
    and to_regprocedure('cron.schedule(text,text,text)') is not null
  then
    execute 'select jobid from cron.job where jobname = $1 limit 1'
      into existing_job_id
      using 'sudak-publish-due-publications';
    if existing_job_id is null then
      execute 'select cron.schedule($1, $2, $3)'
        using
          'sudak-publish-due-publications',
          '* * * * *',
          'select public.publish_due_publications(100);';
    end if;

    existing_job_id := null;
    execute 'select jobid from cron.job where jobname = $1 limit 1'
      into existing_job_id
      using 'sudak-complete-expired-publications';
    if existing_job_id is null then
      execute 'select cron.schedule($1, $2, $3)'
        using
          'sudak-complete-expired-publications',
          '*/10 * * * *',
          'select public.complete_expired_publications(500);';
    end if;
  else
    raise exception 'pg_cron is required for scheduled publication jobs';
  end if;
end
$$;
