-- Keep one open organization candidate per normalized name and make imported
-- publication freshness a server-side invariant.

create or replace function public.normalize_import_organization_name(value text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(
    regexp_replace(lower(replace(normalize(value, NFKC), 'ё', 'е')), '[^a-zа-я0-9]+', ' ', 'gi'),
    '[[:space:]]+',
    ' ',
    'g'
  ));
$$;

revoke all on function public.normalize_import_organization_name(text)
  from public, anon, authenticated;
grant execute on function public.normalize_import_organization_name(text)
  to authenticated, service_role;

alter table public.content_candidates
  add column if not exists organization_identity_key text;

create or replace function public.set_content_candidate_organization_identity_key()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.organization_identity_key := case
    when new.action = 'create_organization'
      then public.normalize_import_organization_name(new.payload ->> 'name')
    else null
  end;
  return new;
end;
$$;

revoke all on function public.set_content_candidate_organization_identity_key() from public;

drop trigger if exists set_content_candidate_organization_identity_key_trigger
  on public.content_candidates;
create trigger set_content_candidate_organization_identity_key_trigger
before insert or update of action, payload on public.content_candidates
for each row execute function public.set_content_candidate_organization_identity_key();

update public.content_candidates candidate
set organization_identity_key = public.normalize_import_organization_name(candidate.payload ->> 'name')
where candidate.action = 'create_organization'
  and candidate.organization_identity_key is distinct from
    public.normalize_import_organization_name(candidate.payload ->> 'name');

alter table public.content_candidates
  drop constraint if exists content_candidates_organization_identity_matches_action,
  add constraint content_candidates_organization_identity_matches_action check (
    (
      action = 'create_organization'
      and nullif(btrim(organization_identity_key), '') is not null
    )
    or (
      action <> 'create_organization'
      and organization_identity_key is null
    )
  );

-- If exactly one active organization already has the normalized name, use it
-- as the canonical target instead of keeping a synthetic dependency.
with active_matches as (
  select
    candidate.id as candidate_id,
    min(organization.id::text)::uuid as organization_id,
    min(organization.name) as organization_name
  from public.content_candidates candidate
  join public.organizations organization
    on organization.status = 'active'
   and public.normalize_import_organization_name(organization.name)
     = candidate.organization_identity_key
  where candidate.action = 'create_organization'
    and candidate.status in ('pending', 'duplicate')
  group by candidate.id
  having count(*) = 1
)
update public.content_candidates publication_candidate
set depends_on_candidate_id = null,
    target_organization_id = active_matches.organization_id,
    payload = publication_candidate.payload || jsonb_build_object(
      'organizationId', active_matches.organization_id::text,
      'organizationName', active_matches.organization_name
    ),
    updated_at = now()
from active_matches
where publication_candidate.depends_on_candidate_id = active_matches.candidate_id
  and publication_candidate.action in ('create_publication', 'update_publication', 'cancel_publication')
  and publication_candidate.status in ('pending', 'duplicate');

with active_matches as (
  select
    candidate.id as candidate_id,
    min(organization.id::text)::uuid as organization_id
  from public.content_candidates candidate
  join public.organizations organization
    on organization.status = 'active'
   and public.normalize_import_organization_name(organization.name)
     = candidate.organization_identity_key
  where candidate.action = 'create_organization'
    and candidate.status in ('pending', 'duplicate')
  group by candidate.id
  having count(*) = 1
)
update public.content_candidates candidate
set status = 'duplicate',
    duplicate_of_id = null,
    duplicate_publication_id = null,
    duplicate_organization_id = active_matches.organization_id,
    decision = null,
    review_comment = null,
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now()
from active_matches
where candidate.id = active_matches.candidate_id;

-- For names that still have no active organization, keep one canonical open
-- candidate and repoint every dependent publication to it. Historical rows are
-- retained as duplicates for the audit trail.
with ranked as (
  select
    candidate.id,
    candidate.organization_identity_key,
    row_number() over (
      partition by candidate.organization_identity_key
      order by (candidate.status = 'pending') desc, candidate.created_at, candidate.id
    ) as position
  from public.content_candidates candidate
  where candidate.action = 'create_organization'
    and candidate.status in ('pending', 'duplicate')
    and candidate.duplicate_organization_id is null
), canonical as (
  select organization_identity_key, id
  from ranked
  where position = 1
)
update public.content_candidates publication_candidate
set depends_on_candidate_id = canonical.id,
    updated_at = now()
from ranked duplicate_candidate
join canonical
  on canonical.organization_identity_key = duplicate_candidate.organization_identity_key
where publication_candidate.depends_on_candidate_id = duplicate_candidate.id
  and publication_candidate.depends_on_candidate_id is distinct from canonical.id
  and publication_candidate.status in ('pending', 'duplicate');

with ranked as (
  select
    candidate.id,
    candidate.organization_identity_key,
    row_number() over (
      partition by candidate.organization_identity_key
      order by (candidate.status = 'pending') desc, candidate.created_at, candidate.id
    ) as position
  from public.content_candidates candidate
  where candidate.action = 'create_organization'
    and candidate.status in ('pending', 'duplicate')
    and candidate.duplicate_organization_id is null
)
update public.content_candidates candidate
set status = 'pending',
    duplicate_of_id = null,
    duplicate_publication_id = null,
    duplicate_organization_id = null,
    decision = null,
    review_comment = null,
    reviewed_by = null,
    reviewed_at = null,
    duplicate_reviewed_by = null,
    duplicate_reviewed_at = null,
    updated_at = now()
from ranked
where candidate.id = ranked.id
  and ranked.position = 1;

with ranked as (
  select
    candidate.id,
    candidate.organization_identity_key,
    first_value(candidate.id) over (
      partition by candidate.organization_identity_key
      order by (candidate.status = 'pending') desc, candidate.created_at, candidate.id
    ) as canonical_id,
    row_number() over (
      partition by candidate.organization_identity_key
      order by (candidate.status = 'pending') desc, candidate.created_at, candidate.id
    ) as position
  from public.content_candidates candidate
  where candidate.action = 'create_organization'
    and candidate.status in ('pending', 'duplicate')
    and candidate.duplicate_organization_id is null
)
update public.content_candidates candidate
set status = 'duplicate',
    duplicate_of_id = ranked.canonical_id,
    duplicate_publication_id = null,
    duplicate_organization_id = null,
    decision = null,
    review_comment = null,
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now()
from ranked
where candidate.id = ranked.id
  and ranked.position > 1;

create unique index if not exists content_candidates_pending_organization_identity_uidx
  on public.content_candidates(organization_identity_key)
  where action = 'create_organization' and status = 'pending';

create index if not exists content_candidates_open_organization_identity_idx
  on public.content_candidates(organization_identity_key, status, created_at)
  where action = 'create_organization' and status in ('pending', 'duplicate');

create or replace function public.extract_import_source_published_at(candidate_warnings jsonb)
returns timestamptz
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  warning_text text;
  raw_value text;
  parts text[];
  month_number integer;
begin
  if jsonb_typeof(candidate_warnings) is distinct from 'array' then
    return null;
  end if;

  for warning_text in select value from jsonb_array_elements_text(candidate_warnings) value
  loop
    if warning_text not like 'Дата исходного материала:%' then
      continue;
    end if;
    raw_value := regexp_replace(
      substring(warning_text from char_length('Дата исходного материала:') + 1),
      '[.]$',
      ''
    );
    raw_value := btrim(raw_value);

    begin
      return raw_value::timestamptz;
    exception when others then
      null;
    end;

    parts := regexp_match(
      lower(raw_value),
      '([0-9]{1,2})[[:space:]]+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)[[:space:]]+(20[0-9]{2})'
    );
    if parts is null then
      continue;
    end if;
    month_number := case parts[2]
      when 'января' then 1 when 'февраля' then 2 when 'марта' then 3
      when 'апреля' then 4 when 'мая' then 5 when 'июня' then 6
      when 'июля' then 7 when 'августа' then 8 when 'сентября' then 9
      when 'октября' then 10 when 'ноября' then 11 when 'декабря' then 12
    end;
    return make_timestamptz(parts[3]::integer, month_number, parts[1]::integer, 0, 0, 0, 'Europe/Moscow');
  end loop;
  return null;
end;
$$;

revoke all on function public.extract_import_source_published_at(jsonb)
  from public, anon, authenticated;
grant execute on function public.extract_import_source_published_at(jsonb) to service_role;

with parsed as (
  select
    candidate.id,
    public.extract_import_source_published_at(candidate.warnings) as source_published_at
  from public.content_candidates candidate
  where candidate.action in ('create_publication', 'update_publication')
    and candidate.status in ('pending', 'duplicate')
    and candidate.payload ->> 'type' = 'news'
    and nullif(candidate.payload ->> 'sourcePublishedAt', '') is null
), usable as (
  select id, source_published_at
  from parsed
  where source_published_at is not null
)
update public.content_candidates candidate
set payload = jsonb_set(
      jsonb_set(
        candidate.payload,
        '{sourcePublishedAt}',
        to_jsonb(to_char(usable.source_published_at at time zone 'Europe/Moscow', 'YYYY-MM-DD"T"HH24:MI:SS') || '+03:00')
      ),
      '{validUntil}',
      to_jsonb(to_char((usable.source_published_at + interval '7 days') at time zone 'Europe/Moscow', 'YYYY-MM-DD"T"HH24:MI:SS') || '+03:00')
    ),
    updated_at = now()
from usable
where candidate.id = usable.id;

-- Recalculate the seven-day window for every open imported news candidate that
-- already carries a reliable source date.
update public.content_candidates candidate
set payload = jsonb_set(
      candidate.payload,
      '{validUntil}',
      to_jsonb(to_char(
        ((candidate.payload ->> 'sourcePublishedAt')::timestamptz + interval '7 days') at time zone 'Europe/Moscow',
        'YYYY-MM-DD"T"HH24:MI:SS'
      ) || '+03:00')
    ),
    updated_at = now()
where candidate.action in ('create_publication', 'update_publication')
  and candidate.status in ('pending', 'duplicate')
  and candidate.payload ->> 'type' = 'news'
  and nullif(candidate.payload ->> 'sourcePublishedAt', '') is not null;

update public.content_candidates candidate
set status = 'stale',
    decision = null,
    updated_at = now()
where candidate.action in ('create_publication', 'update_publication')
  and candidate.status in ('pending', 'duplicate')
  and (
    (
      candidate.payload ->> 'type' = 'event'
      and nullif(candidate.payload ->> 'endsAt', '') is not null
      and (candidate.payload ->> 'endsAt')::timestamptz <= now()
    )
    or (
      candidate.payload ->> 'type' <> 'event'
      and nullif(candidate.payload ->> 'validUntil', '') is not null
      and (candidate.payload ->> 'validUntil')::timestamptz <= now()
    )
  );

update public.content_candidates candidate
set warnings = candidate.warnings || to_jsonb(
      'Дата публикации в первичном источнике не подтверждена. Проверьте её вручную перед публикацией.'::text
    ),
    updated_at = now()
where candidate.action in ('create_publication', 'update_publication')
  and candidate.status in ('pending', 'duplicate')
  and candidate.payload ->> 'type' = 'news'
  and nullif(candidate.payload ->> 'sourcePublishedAt', '') is null
  and not exists (
    select 1
    from jsonb_array_elements_text(candidate.warnings) warning(value)
    where warning.value = 'Дата публикации в первичном источнике не подтверждена. Проверьте её вручную перед публикацией.'
  );

-- Wrap the existing publication writer instead of copying its full body. The
-- public signature stays unchanged, while direct and combined review paths gain
-- the same temporal checks.
do $$
begin
  if to_regprocedure(
    'public.save_imported_publication_unchecked(uuid,public.content_candidate_action,jsonb,boolean,uuid,uuid,uuid,uuid)'
  ) is null then
    execute 'alter function public.save_imported_publication(uuid, public.content_candidate_action, jsonb, boolean, uuid, uuid, uuid, uuid) rename to save_imported_publication_unchecked';
  end if;
end;
$$;

create or replace function public.save_imported_publication(
  p_candidate_id uuid,
  p_action public.content_candidate_action,
  p_payload jsonb,
  p_publish boolean,
  p_actor_id uuid,
  p_candidate_organization_id uuid,
  p_candidate_target_publication_id uuid,
  p_depends_on_candidate_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  publication_ends_at timestamptz := nullif(p_payload ->> 'endsAt', '')::timestamptz;
  publication_valid_until timestamptz := nullif(p_payload ->> 'validUntil', '')::timestamptz;
  source_published_at timestamptz := nullif(p_payload ->> 'sourcePublishedAt', '')::timestamptz;
begin
  if p_publish and p_payload ->> 'type' = 'event'
    and publication_ends_at is not null
    and publication_ends_at <= now()
  then
    raise exception using errcode = '22023', message = 'Imported event has already ended';
  end if;

  if p_publish and p_payload ->> 'type' = 'news' then
    if source_published_at is null then
      raise exception using errcode = '22023', message = 'Imported news source publication date is required';
    end if;
    if publication_valid_until is distinct from source_published_at + interval '7 days' then
      raise exception using errcode = '22023', message = 'Imported news validity must equal seven days from its source publication date';
    end if;
  end if;

  return public.save_imported_publication_unchecked(
    p_candidate_id,
    p_action,
    p_payload,
    p_publish,
    p_actor_id,
    p_candidate_organization_id,
    p_candidate_target_publication_id,
    p_depends_on_candidate_id
  );
end;
$$;

revoke all on function public.save_imported_publication_unchecked(
  uuid, public.content_candidate_action, jsonb, boolean, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.save_imported_publication(
  uuid, public.content_candidate_action, jsonb, boolean, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

-- Wrap every review path with a transaction-scoped advisory lock derived from
-- the normalized organization name. A concurrent second approval waits, then
-- sees the active organization created by the first transaction and fails.
do $$
begin
  if to_regprocedure(
    'public.review_content_candidate_unlocked(uuid,public.content_candidate_decision,jsonb,text)'
  ) is null then
    execute 'alter function public.review_content_candidate(uuid, public.content_candidate_decision, jsonb, text) rename to review_content_candidate_unlocked';
  end if;
end;
$$;

create or replace function public.review_content_candidate(
  p_candidate_id uuid,
  p_decision public.content_candidate_decision,
  p_payload jsonb default null,
  p_review_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  candidate_record public.content_candidates;
  final_payload jsonb;
  organization_identity_key text;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select candidate.*
    into candidate_record
  from public.content_candidates candidate
  where candidate.id = p_candidate_id;

  if candidate_record.id is null then
    raise exception using errcode = '22023', message = 'Content candidate not found';
  end if;

  if candidate_record.action = 'create_organization'
    and p_decision = 'approve_publish'
    and candidate_record.status <> 'approved'
  then
    final_payload := coalesce(p_payload, candidate_record.payload);
    organization_identity_key := public.normalize_import_organization_name(final_payload ->> 'name');
    if nullif(organization_identity_key, '') is not null then
      perform pg_advisory_xact_lock(hashtextextended(organization_identity_key, 0));
      if exists (
        select 1
        from public.organizations organization
        where organization.status = 'active'
          and public.normalize_import_organization_name(organization.name) = organization_identity_key
      ) then
        raise exception using errcode = '23505', message = 'Active organization with this normalized name already exists';
      end if;
    end if;
  end if;

  return public.review_content_candidate_unlocked(
    p_candidate_id,
    p_decision,
    p_payload,
    p_review_comment
  );
end;
$$;

revoke all on function public.review_content_candidate_unlocked(
  uuid, public.content_candidate_decision, jsonb, text
) from public, anon, authenticated, service_role;
revoke all on function public.review_content_candidate(
  uuid, public.content_candidate_decision, jsonb, text
) from public, anon, authenticated, service_role;
grant execute on function public.review_content_candidate(
  uuid, public.content_candidate_decision, jsonb, text
) to authenticated;

notify pgrst, 'reload schema';
