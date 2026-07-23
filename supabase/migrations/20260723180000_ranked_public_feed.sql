-- Transparent, time-aware and cursor-pageable public feed.

create or replace function public.list_ranked_publication_ids(
  p_filter text default 'all',
  p_reference timestamptz default now(),
  p_cursor_rank integer default null,
  p_cursor_key double precision default null,
  p_cursor_id uuid default null,
  p_limit integer default 13
)
returns table (
  publication_id uuid,
  relevance_rank integer,
  relevance_key double precision
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  sudak_timezone constant text := 'Europe/Moscow';
  selected_day_start timestamptz;
  selected_day_end timestamptz;
  selected_weekday integer;
begin
  if p_filter not in ('all', 'today', 'tomorrow', 'kids', 'food', 'culture', 'sport', 'free') then
    raise exception using errcode = '22023', message = 'Unsupported publication filter';
  end if;

  if p_limit < 1 or p_limit > 50 then
    raise exception using errcode = '22023', message = 'Feed page size must be between 1 and 50';
  end if;

  selected_day_start := (
    date_trunc('day', p_reference at time zone sudak_timezone)
    + case when p_filter = 'tomorrow' then interval '1 day' else interval '0 days' end
  ) at time zone sudak_timezone;
  selected_day_end := selected_day_start + interval '1 day';
  selected_weekday := extract(
    isodow from selected_day_start at time zone sudak_timezone
  )::integer;

  return query
  with candidates as (
    select
      publication.id as publication_id,
      case
        when exists (
          select 1
          from public.important_announcements announcement
          where announcement.publication_id = publication.id
            and announcement.status = 'active'
            and announcement.active_from <= p_reference
            and announcement.active_until >= p_reference
        ) then 0
        when publication.type = 'event'
          and publication.starts_at <= p_reference
          and coalesce(publication.ends_at, publication.starts_at) >= p_reference
          then 1
        when publication.type = 'event'
          and publication.starts_at > p_reference
          then 2
        when publication.valid_until between p_reference and p_reference + interval '24 hours'
          then 3
        when publication.type = 'regular'
          and publication.valid_until >= selected_day_start
          and exists (
            select 1
            from public.publication_schedules schedule
            where schedule.publication_id = publication.id
              and (schedule.weekday is null or schedule.weekday = selected_weekday)
          ) then 4
        when publication.type = 'news' then 5
        else 6
      end::integer as relevance_rank,
      case
        when exists (
          select 1
          from public.important_announcements announcement
          where announcement.publication_id = publication.id
            and announcement.status = 'active'
            and announcement.active_from <= p_reference
            and announcement.active_until >= p_reference
        ) then -extract(epoch from coalesce(publication.published_at, publication.updated_at))
        when publication.type = 'event'
          and publication.starts_at <= p_reference
          and coalesce(publication.ends_at, publication.starts_at) >= p_reference
          then extract(epoch from coalesce(publication.ends_at, publication.starts_at))
        when publication.type = 'event'
          and publication.starts_at > p_reference
          then extract(epoch from publication.starts_at)
        when publication.valid_until between p_reference and p_reference + interval '24 hours'
          then extract(epoch from publication.valid_until)
        when publication.type = 'regular'
          and publication.valid_until >= selected_day_start
          then coalesce(
            (
              select min(extract(epoch from schedule.starts_at))
              from public.publication_schedules schedule
              where schedule.publication_id = publication.id
                and (schedule.weekday is null or schedule.weekday = selected_weekday)
            ),
            86400::double precision
          )
        else -extract(epoch from coalesce(publication.published_at, publication.updated_at))
      end::double precision as relevance_key
    from public.publications publication
    join public.publication_categories category
      on category.id = publication.category_id
    where public.is_public_publication(publication)
      and publication.published_at <= p_reference
      and (
        p_filter not in ('today', 'tomorrow')
        or (
          publication.type = 'event'
          and publication.starts_at < selected_day_end
          and coalesce(publication.ends_at, publication.starts_at) >= selected_day_start
        )
        or (
          publication.type = 'regular'
          and publication.valid_until >= selected_day_start
          and exists (
            select 1
            from public.publication_schedules schedule
            where schedule.publication_id = publication.id
              and (schedule.weekday is null or schedule.weekday = selected_weekday)
          )
        )
        or (
          publication.type in ('announcement', 'promo', 'news')
          and publication.valid_until >= selected_day_start
        )
      )
      and (
        p_filter in ('all', 'today', 'tomorrow')
        or (p_filter = 'kids' and (category.slug = 'kids' or nullif(btrim(coalesce(publication.age_limit, '')), '') is not null))
        or (p_filter = 'free' and publication.is_free)
        or (p_filter in ('food', 'culture', 'sport') and category.slug = p_filter)
      )
  )
  select
    candidate.publication_id,
    candidate.relevance_rank,
    candidate.relevance_key
  from candidates candidate
  where p_cursor_rank is null
    or (
      candidate.relevance_rank,
      candidate.relevance_key,
      candidate.publication_id
    ) > (
      p_cursor_rank,
      p_cursor_key,
      p_cursor_id
    )
  order by
    candidate.relevance_rank,
    candidate.relevance_key,
    candidate.publication_id
  limit p_limit;
end;
$$;

revoke all on function public.list_ranked_publication_ids(
  text, timestamptz, integer, double precision, uuid, integer
) from public;
grant execute on function public.list_ranked_publication_ids(
  text, timestamptz, integer, double precision, uuid, integer
) to anon, authenticated;
