-- Admin-reviewed content ingestion queue.
-- External collectors may enqueue normalized candidates with service_role, but only
-- an authenticated administrator can turn a candidate into public product data.

do $$
begin
  create type public.content_source_kind as enum ('html', 'rss', 'manual');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_source_trust as enum ('official', 'partner', 'discovery');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_ingestion_trigger as enum ('cron', 'admin', 'agent');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_ingestion_run_status as enum (
    'queued', 'running', 'succeeded', 'partial', 'failed', 'skipped'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_candidate_action as enum (
    'create_organization',
    'create_publication',
    'update_publication',
    'cancel_publication'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_candidate_status as enum (
    'pending', 'approved', 'rejected', 'duplicate', 'stale', 'failed'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_candidate_decision as enum (
    'approve_publish', 'approve_draft', 'reject', 'mark_not_duplicate'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.content_source_kind not null,
  url text not null,
  canonical_url text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  trust_level public.content_source_trust not null default 'discovery',
  is_active boolean not null default true,
  fetch_interval_minutes integer not null default 1440,
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  etag text,
  last_modified text,
  consecutive_failures integer not null default 0,
  last_error text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_sources_name_not_empty check (nullif(btrim(name), '') is not null),
  constraint content_sources_https_url check (lower(url) like 'https://%'),
  constraint content_sources_https_canonical_url check (lower(canonical_url) like 'https://%'),
  constraint content_sources_fetch_interval_range check (fetch_interval_minutes between 5 and 43200),
  constraint content_sources_failures_nonnegative check (consecutive_failures >= 0),
  constraint content_sources_error_length check (last_error is null or char_length(last_error) <= 1000)
);

create unique index if not exists content_sources_canonical_url_uidx
  on public.content_sources(lower(canonical_url));
create index if not exists content_sources_due_idx
  on public.content_sources(next_check_at, id)
  where is_active;
create index if not exists content_sources_organization_idx
  on public.content_sources(organization_id, is_active)
  where organization_id is not null;

create table if not exists public.content_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.content_sources(id) on delete set null,
  source_url text,
  trigger public.content_ingestion_trigger not null,
  status public.content_ingestion_run_status not null default 'queued',
  idempotency_key text not null unique,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  started_at timestamptz,
  finished_at timestamptz,
  discovered_count integer not null default 0,
  created_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_ingestion_runs_source_or_url check (
    source_id is not null or nullif(btrim(coalesce(source_url, '')), '') is not null
  ),
  constraint content_ingestion_runs_requested_url_https check (
    source_url is null or lower(source_url) like 'https://%'
  ),
  constraint content_ingestion_runs_idempotency_key_not_empty check (
    nullif(btrim(idempotency_key), '') is not null
  ),
  constraint content_ingestion_runs_counters_nonnegative check (
    discovered_count >= 0 and created_count >= 0
    and duplicate_count >= 0 and failed_count >= 0
  ),
  constraint content_ingestion_runs_finished_after_started check (
    started_at is null or finished_at is null or finished_at >= started_at
  ),
  constraint content_ingestion_runs_error_length check (
    error_message is null or char_length(error_message) <= 1000
  )
);

create index if not exists content_ingestion_runs_status_created_idx
  on public.content_ingestion_runs(status, created_at, id);
create index if not exists content_ingestion_runs_source_created_idx
  on public.content_ingestion_runs(source_id, created_at desc)
  where source_id is not null;

create table if not exists public.content_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.content_sources(id) on delete set null,
  run_id uuid references public.content_ingestion_runs(id) on delete set null,
  depends_on_candidate_id uuid references public.content_candidates(id) on delete set null,
  action public.content_candidate_action not null,
  status public.content_candidate_status not null default 'pending',
  payload jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  source_url text not null,
  source_checked_at timestamptz not null default now(),
  external_id text,
  content_hash text not null,
  normalized_fingerprint text not null,
  duplicate_of_id uuid references public.content_candidates(id) on delete set null,
  duplicate_publication_id uuid references public.publications(id) on delete set null,
  duplicate_organization_id uuid references public.organizations(id) on delete set null,
  target_organization_id uuid references public.organizations(id) on delete set null,
  target_publication_id uuid references public.publications(id) on delete set null,
  result_organization_id uuid references public.organizations(id) on delete set null,
  result_publication_id uuid references public.publications(id) on delete set null,
  source_excerpt text,
  raw_expires_at timestamptz not null default (now() + interval '30 days'),
  decision public.content_candidate_decision,
  review_comment text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  duplicate_reviewed_by uuid references auth.users(id) on delete set null,
  duplicate_reviewed_at timestamptz,
  error_message text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_candidates_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint content_candidates_payload_kind_matches_action check (
    (action = 'create_organization' and payload ->> 'kind' = 'organization')
    or (
      action in ('create_publication', 'update_publication', 'cancel_publication')
      and payload ->> 'kind' = 'publication'
    )
  ),
  constraint content_candidates_evidence_array check (jsonb_typeof(evidence) = 'array'),
  constraint content_candidates_warnings_array check (jsonb_typeof(warnings) = 'array'),
  constraint content_candidates_https_source_url check (lower(source_url) like 'https://%'),
  constraint content_candidates_content_hash_not_empty check (nullif(btrim(content_hash), '') is not null),
  constraint content_candidates_fingerprint_not_empty check (nullif(btrim(normalized_fingerprint), '') is not null),
  constraint content_candidates_external_id_not_empty check (
    external_id is null or nullif(btrim(external_id), '') is not null
  ),
  constraint content_candidates_target_matches_action check (
    (action in ('create_organization', 'create_publication') and target_publication_id is null)
    or (
      action in ('update_publication', 'cancel_publication')
      and target_publication_id is not null
      and nullif(payload ->> 'targetPublicationId', '') is not null
    )
  ),
  constraint content_candidates_dependency_not_self check (
    depends_on_candidate_id is null or depends_on_candidate_id <> id
  ),
  constraint content_candidates_duplicate_not_self check (
    duplicate_of_id is null or duplicate_of_id <> id
  ),
  constraint content_candidates_duplicate_has_target check (
    status <> 'duplicate'
    or duplicate_of_id is not null
    or duplicate_publication_id is not null
    or duplicate_organization_id is not null
  ),
  constraint content_candidates_review_state check (
    (
      status = 'approved'
      and decision in ('approve_publish', 'approve_draft')
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      status = 'rejected'
      and decision = 'reject'
      and reviewed_by is not null
      and reviewed_at is not null
    )
    or (
      status in ('pending', 'duplicate', 'stale', 'failed')
      and decision is null
    )
  ),
  constraint content_candidates_result_matches_action check (
    status <> 'approved'
    or (action = 'create_organization' and result_organization_id is not null)
    or (action in ('create_publication', 'update_publication', 'cancel_publication') and result_publication_id is not null)
  ),
  constraint content_candidates_error_length check (
    error_message is null or char_length(error_message) <= 1000
  )
);

create unique index if not exists content_candidates_source_version_uidx
  on public.content_candidates(lower(source_url), coalesce(external_id, ''), content_hash);
create index if not exists content_candidates_fingerprint_idx
  on public.content_candidates(normalized_fingerprint, created_at desc);
create index if not exists content_candidates_review_queue_idx
  on public.content_candidates(status, action, created_at, id);
create index if not exists content_candidates_source_idx
  on public.content_candidates(source_id, created_at desc)
  where source_id is not null;
create index if not exists content_candidates_run_idx
  on public.content_candidates(run_id, created_at, id)
  where run_id is not null;
create index if not exists content_candidates_dependency_idx
  on public.content_candidates(depends_on_candidate_id, status)
  where depends_on_candidate_id is not null;
create index if not exists content_candidates_raw_expiry_idx
  on public.content_candidates(raw_expires_at, id)
  where source_excerpt is not null;

drop trigger if exists set_content_sources_updated_at on public.content_sources;
create trigger set_content_sources_updated_at
before update on public.content_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_content_ingestion_runs_updated_at on public.content_ingestion_runs;
create trigger set_content_ingestion_runs_updated_at
before update on public.content_ingestion_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_content_candidates_updated_at on public.content_candidates;
create trigger set_content_candidates_updated_at
before update on public.content_candidates
for each row execute function public.set_updated_at();

create or replace function public.protect_content_candidate_system_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if auth.uid() is null or not public.is_admin() then
      raise exception using errcode = '42501', message = 'Administrator access required';
    end if;

    if old.status not in ('pending', 'duplicate')
      or new.id <> old.id
      or new.source_id is distinct from old.source_id
      or new.run_id is distinct from old.run_id
      or new.depends_on_candidate_id is distinct from old.depends_on_candidate_id
      or new.action <> old.action
      or new.status <> old.status
      or new.source_url <> old.source_url
      or new.source_checked_at <> old.source_checked_at
      or new.external_id is distinct from old.external_id
      or new.content_hash <> old.content_hash
      or new.normalized_fingerprint <> old.normalized_fingerprint
      or new.duplicate_of_id is distinct from old.duplicate_of_id
      or new.duplicate_publication_id is distinct from old.duplicate_publication_id
      or new.duplicate_organization_id is distinct from old.duplicate_organization_id
      or new.result_organization_id is distinct from old.result_organization_id
      or new.result_publication_id is distinct from old.result_publication_id
      or new.decision is distinct from old.decision
      or new.review_comment is distinct from old.review_comment
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.duplicate_reviewed_by is distinct from old.duplicate_reviewed_by
      or new.duplicate_reviewed_at is distinct from old.duplicate_reviewed_at
    then
      raise exception using errcode = '42501', message = 'Candidate system fields can only be changed through a review RPC';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_content_candidate_system_fields_trigger
  on public.content_candidates;
create trigger protect_content_candidate_system_fields_trigger
before update on public.content_candidates
for each row execute function public.protect_content_candidate_system_fields();

create or replace function public.write_content_ingestion_audit_event()
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
begin
  if tg_table_name = 'content_candidates' then
    old_json := old_json - 'source_excerpt';
    new_json := new_json - 'source_excerpt';
  end if;

  target_organization_id := coalesce(
    (new_json ->> 'target_organization_id')::uuid,
    (new_json ->> 'result_organization_id')::uuid,
    (old_json ->> 'target_organization_id')::uuid,
    (old_json ->> 'result_organization_id')::uuid
  );

  event_action := case
    when tg_op = 'INSERT' then tg_table_name || '.created'
    when tg_op = 'DELETE' then tg_table_name || '.deleted'
    when tg_table_name = 'content_candidates'
      and (old_json ->> 'duplicate_reviewed_at') is distinct from (new_json ->> 'duplicate_reviewed_at')
      then 'content_candidates.duplicate_cleared'
    when (old_json ->> 'status') is distinct from (new_json ->> 'status')
      then tg_table_name || '.status.' || coalesce(new_json ->> 'status', 'none')
    else tg_table_name || '.updated'
  end;

  insert into public.audit_events (
    actor_id, entity_type, entity_id, organization_id, action,
    reason, old_data, new_data
  )
  values (
    auth.uid(), tg_table_name, target_id, target_organization_id, event_action,
    nullif(btrim(coalesce(new_json ->> 'review_comment', new_json ->> 'error_message', '')), ''),
    old_json, new_json
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_content_sources on public.content_sources;
create trigger audit_content_sources
after insert or update or delete on public.content_sources
for each row execute function public.write_content_ingestion_audit_event();

drop trigger if exists audit_content_ingestion_runs on public.content_ingestion_runs;
create trigger audit_content_ingestion_runs
after insert or update or delete on public.content_ingestion_runs
for each row execute function public.write_content_ingestion_audit_event();

drop trigger if exists audit_content_candidates on public.content_candidates;
create trigger audit_content_candidates
after insert or update or delete on public.content_candidates
for each row execute function public.write_content_ingestion_audit_event();

alter table public.content_sources enable row level security;
alter table public.content_ingestion_runs enable row level security;
alter table public.content_candidates enable row level security;

drop policy if exists "Admins can read content sources" on public.content_sources;
create policy "Admins can read content sources"
on public.content_sources for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can create content sources" on public.content_sources;
create policy "Admins can create content sources"
on public.content_sources for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update content sources" on public.content_sources;
create policy "Admins can update content sources"
on public.content_sources for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete content sources" on public.content_sources;
create policy "Admins can delete content sources"
on public.content_sources for delete to authenticated
using (public.is_admin());

drop policy if exists "Admins can read ingestion runs" on public.content_ingestion_runs;
create policy "Admins can read ingestion runs"
on public.content_ingestion_runs for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can read content candidates" on public.content_candidates;
create policy "Admins can read content candidates"
on public.content_candidates for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can edit pending content candidates" on public.content_candidates;
create policy "Admins can edit pending content candidates"
on public.content_candidates for update to authenticated
using (public.is_admin() and status in ('pending', 'duplicate'))
with check (public.is_admin() and status in ('pending', 'duplicate'));

revoke all on table public.content_sources from public, anon, authenticated;
revoke all on table public.content_ingestion_runs from public, anon, authenticated;
revoke all on table public.content_candidates from public, anon, authenticated;

grant select, insert, update, delete on table public.content_sources to authenticated;
grant select on table public.content_ingestion_runs to authenticated;
grant select, update on table public.content_candidates to authenticated;

grant select, insert, update, delete on table public.content_sources to service_role;
grant select, insert, update, delete on table public.content_ingestion_runs to service_role;
grant select, insert, update, delete on table public.content_candidates to service_role;

create or replace function public.claim_due_content_sources(p_limit integer default 5)
returns setof public.content_sources
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 5 then
    raise exception using errcode = '22023', message = 'Source claim limit must be between 1 and 5';
  end if;

  return query
  with due as (
    select source.id
    from public.content_sources source
    where source.is_active
      and source.next_check_at <= now()
    order by source.next_check_at, source.id
    for update skip locked
    limit p_limit
  )
  update public.content_sources source
  set last_checked_at = now(),
      next_check_at = now() + make_interval(mins => source.fetch_interval_minutes),
      updated_at = now()
  from due
  where source.id = due.id
  returning source.*;
end;
$$;

revoke all on function public.claim_due_content_sources(integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_content_sources(integer) to service_role;

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
  target_organization_id uuid := coalesce(
    p_candidate_organization_id,
    nullif(p_payload ->> 'organizationId', '')::uuid
  );
  target_publication_id uuid := coalesce(
    p_candidate_target_publication_id,
    nullif(p_payload ->> 'targetPublicationId', '')::uuid
  );
  publication_kind public.publication_type := (p_payload ->> 'type')::public.publication_type;
  publication_category_id uuid := nullif(p_payload ->> 'categoryId', '')::uuid;
  normalized_title text := nullif(btrim(coalesce(p_payload ->> 'title', '')), '');
  normalized_description text := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
  normalized_place text := nullif(btrim(coalesce(p_payload ->> 'place', '')), '');
  normalized_price text := nullif(btrim(coalesce(p_payload ->> 'priceText', '')), '');
  normalized_age_limit text := nullif(btrim(coalesce(p_payload ->> 'ageLimit', '')), '');
  normalized_contact_phone text := nullif(btrim(coalesce(p_payload ->> 'contactPhone', '')), '');
  normalized_schedule jsonb := coalesce(p_payload -> 'scheduleEntries', '[]'::jsonb);
  publication_starts_at timestamptz := nullif(p_payload ->> 'startsAt', '')::timestamptz;
  publication_ends_at timestamptz := nullif(p_payload ->> 'endsAt', '')::timestamptz;
  publication_valid_until timestamptz := nullif(p_payload ->> 'validUntil', '')::timestamptz;
  publication_is_free boolean := coalesce(nullif(p_payload ->> 'isFree', '')::boolean, false);
  target_status public.publication_status := case
    when p_publish then 'published'::public.publication_status
    else 'draft'::public.publication_status
  end;
  dependency_result uuid;
  category_slug_value text;
  schedule_count integer;
  existing_record public.publications;
  saved_record public.publications;
  generated_id uuid;
  generated_slug text;
begin
  if p_action not in ('create_publication', 'update_publication') then
    raise exception using errcode = '22023', message = 'Unsupported imported publication action';
  end if;

  if target_organization_id is null and p_depends_on_candidate_id is not null then
    select candidate.result_organization_id
      into dependency_result
    from public.content_candidates candidate
    where candidate.id = p_depends_on_candidate_id
      and candidate.action = 'create_organization'
      and candidate.status = 'approved';

    target_organization_id := dependency_result;
  end if;

  if target_organization_id is null then
    raise exception using errcode = '22023', message = 'Approved organization is required';
  end if;

  if not exists (
    select 1
    from public.organizations organization_record
    where organization_record.id = target_organization_id
      and organization_record.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'Active organization not found';
  end if;

  if normalized_title is null
    or char_length(normalized_title) < 3
    or char_length(normalized_title) > 180
  then
    raise exception using errcode = '22023', message = 'Title must contain from 3 to 180 characters';
  end if;

  select category.slug, category.id
    into category_slug_value, publication_category_id
  from public.publication_categories category
  where (
      (publication_category_id is not null and category.id = publication_category_id)
      or (
        publication_category_id is null
        and category.slug = nullif(btrim(coalesce(p_payload ->> 'categorySlug', '')), '')
      )
    )
    and category.is_active;

  if category_slug_value is null then
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
      "scheduleText" text,
      weekday smallint,
      "startsAt" time,
      "endsAt" time,
      "sortOrder" integer,
      timezone text
    )
    where nullif(btrim(coalesce(entry."scheduleText", '')), '') is null
      or (entry.weekday is not null and entry.weekday not between 1 and 7)
      or (entry."startsAt" is not null and entry."endsAt" is not null and entry."endsAt" < entry."startsAt")
      or nullif(btrim(coalesce(entry.timezone, 'Europe/Moscow')), '') is null
  ) then
    raise exception using errcode = '22023', message = 'Invalid regular schedule entry';
  end if;

  if p_publish then
    if normalized_description is null or char_length(normalized_description) < 10 then
      raise exception using errcode = '22023', message = 'Description must contain at least 10 characters';
    end if;

    if publication_kind = 'event' then
      if publication_starts_at is null
        or publication_ends_at is null
        or publication_ends_at < publication_starts_at
      then
        raise exception using errcode = '22023', message = 'Event start and valid end are required';
      end if;
      if normalized_place is null then
        raise exception using errcode = '22023', message = 'Event place is required';
      end if;
    elsif publication_kind = 'regular' then
      if publication_valid_until is null or publication_valid_until <= now() then
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
        from jsonb_to_recordset(normalized_schedule) as entry("startsAt" time)
        where entry."startsAt" is null
      ) then
        raise exception using errcode = '22023', message = 'Every regular schedule entry requires a start time';
      end if;
    elsif publication_kind in ('announcement', 'promo', 'news') then
      if publication_valid_until is null or publication_valid_until <= now() then
        raise exception using errcode = '22023', message = 'Publication validity date must be in the future';
      end if;
    end if;

    if publication_kind in ('event', 'regular')
      and not publication_is_free
      and normalized_price is null
    then
      raise exception using errcode = '22023', message = 'Price or free marker is required';
    end if;
  end if;

  normalized_price := case
    when publication_is_free then 'Бесплатно'
    when normalized_price is not null then normalized_price
    when publication_kind = 'news' then 'Не применяется'
    when publication_kind = 'promo' then 'Условия в описании'
    else 'Не указано'
  end;

  if p_action = 'update_publication' then
    select publication.*
      into existing_record
    from public.publications publication
    where publication.id = target_publication_id
    for update;

    if existing_record.id is null then
      raise exception using errcode = '22023', message = 'Target publication not found';
    end if;
    if existing_record.organization_id <> target_organization_id then
      raise exception using errcode = '42501', message = 'Publication does not belong to the target organization';
    end if;
    if existing_record.status in ('cancelled', 'completed', 'hidden', 'blocked') then
      raise exception using errcode = '22023', message = 'Publication cannot be edited in its current status';
    end if;
    if existing_record.status = 'published' and not p_publish then
      raise exception using errcode = '22023', message = 'A published publication cannot become a draft';
    end if;

    update public.publications
    set type = publication_kind,
        status = target_status,
        title = normalized_title,
        description = normalized_description,
        category_id = publication_category_id,
        starts_at = case when publication_kind = 'event' then publication_starts_at else null end,
        ends_at = case when publication_kind = 'event' then publication_ends_at else null end,
        valid_until = case when publication_kind = 'event' then null else publication_valid_until end,
        publish_at = null,
        published_at = case when p_publish then coalesce(existing_record.published_at, now()) else existing_record.published_at end,
        sort_published_at = case when p_publish then coalesce(existing_record.sort_published_at, existing_record.published_at, now()) else existing_record.sort_published_at end,
        place = normalized_place,
        price_text = normalized_price,
        is_free = publication_is_free,
        age_limit = normalized_age_limit,
        contact_phone = normalized_contact_phone,
        schedule_last_attempt_at = null,
        schedule_error = null,
        updated_at = now()
    where id = existing_record.id
    returning * into saved_record;
  else
    select publication.*
      into existing_record
    from public.publications publication
    where publication.organization_id = target_organization_id
      and publication.client_request_id = p_candidate_id
    for update;

    if existing_record.id is not null then
      return existing_record.id;
    end if;

    generated_id := gen_random_uuid();
    generated_slug := trim(both '-' from left(
      regexp_replace(lower(normalized_title), '[^a-zа-яё0-9]+', '-', 'gi'),
      48
    ));
    generated_slug := coalesce(nullif(generated_slug, ''), 'publication')
      || '-' || left(replace(generated_id::text, '-', ''), 10);

    insert into public.publications (
      id, organization_id, author_id, client_request_id, slug, type, status,
      title, description, category_id, starts_at, ends_at, valid_until,
      publish_at, published_at, sort_published_at, place, price_text,
      is_free, age_limit, contact_phone
    )
    values (
      generated_id, target_organization_id, p_actor_id, p_candidate_id,
      generated_slug, publication_kind, target_status, normalized_title,
      normalized_description, publication_category_id,
      case when publication_kind = 'event' then publication_starts_at else null end,
      case when publication_kind = 'event' then publication_ends_at else null end,
      case when publication_kind = 'event' then null else publication_valid_until end,
      null,
      case when p_publish then now() else null end,
      case when p_publish then now() else null end,
      normalized_place, normalized_price, publication_is_free,
      normalized_age_limit, normalized_contact_phone
    )
    returning * into saved_record;
  end if;

  delete from public.publication_schedules
  where publication_id = saved_record.id;

  if publication_kind = 'regular' and schedule_count > 0 then
    insert into public.publication_schedules (
      publication_id, schedule_text, weekday, starts_at, ends_at, sort_order, timezone
    )
    select
      saved_record.id,
      btrim(entry."scheduleText"),
      entry.weekday,
      entry."startsAt",
      entry."endsAt",
      coalesce(entry."sortOrder", row_number() over ()::integer - 1),
      coalesce(nullif(btrim(entry.timezone), ''), 'Europe/Moscow')
    from jsonb_to_recordset(normalized_schedule) as entry(
      "scheduleText" text,
      weekday smallint,
      "startsAt" time,
      "endsAt" time,
      "sortOrder" integer,
      timezone text
    );
  end if;

  return saved_record.id;
end;
$$;

revoke all on function public.save_imported_publication(
  uuid, public.content_candidate_action, jsonb, boolean, uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;

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
  normalized_comment text := nullif(btrim(coalesce(p_review_comment, '')), '');
  created_organization_id uuid;
  saved_publication_id uuid;
  organization_type_id uuid;
  organization_contact_links jsonb;
  organization_name text;
  organization_description text;
  organization_phone text;
  cancellation_source_url text;
  target_publication public.publications;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select candidate.*
    into candidate_record
  from public.content_candidates candidate
  where candidate.id = p_candidate_id
  for update;

  if candidate_record.id is null then
    raise exception using errcode = '22023', message = 'Content candidate not found';
  end if;

  if candidate_record.status = 'approved'
    and candidate_record.decision = p_decision
  then
    return jsonb_build_object(
      'candidate_id', candidate_record.id,
      'status', candidate_record.status,
      'decision', candidate_record.decision,
      'organization_id', candidate_record.result_organization_id,
      'publication_id', candidate_record.result_publication_id,
      'idempotent', true
    );
  end if;

  if candidate_record.status = 'rejected'
    and p_decision = 'reject'
  then
    return jsonb_build_object(
      'candidate_id', candidate_record.id,
      'status', candidate_record.status,
      'decision', candidate_record.decision,
      'idempotent', true
    );
  end if;

  if p_decision = 'mark_not_duplicate' then
    if candidate_record.status <> 'duplicate' then
      raise exception using errcode = '22023', message = 'Only a duplicate candidate can be cleared';
    end if;

    update public.content_candidates
    set status = 'pending',
        duplicate_of_id = null,
        duplicate_publication_id = null,
        duplicate_organization_id = null,
        duplicate_reviewed_by = actor_id,
        duplicate_reviewed_at = now(),
        updated_at = now()
    where id = candidate_record.id;

    return jsonb_build_object(
      'candidate_id', candidate_record.id,
      'status', 'pending',
      'decision', p_decision,
      'idempotent', false
    );
  end if;

  if candidate_record.status <> 'pending' then
    raise exception using errcode = '22023', message = 'Candidate cannot be reviewed from its current status';
  end if;

  if p_decision = 'reject' then
    if normalized_comment is null then
      raise exception using errcode = '22023', message = 'Rejection reason is required';
    end if;

    update public.content_candidates
    set status = 'rejected',
        decision = 'reject',
        review_comment = normalized_comment,
        reviewed_by = actor_id,
        reviewed_at = now(),
        updated_at = now()
    where id = candidate_record.id;

    return jsonb_build_object(
      'candidate_id', candidate_record.id,
      'status', 'rejected',
      'decision', 'reject',
      'idempotent', false
    );
  end if;

  final_payload := coalesce(p_payload, candidate_record.payload);

  if jsonb_typeof(final_payload) <> 'object'
    or (
      candidate_record.action = 'create_organization'
      and final_payload ->> 'kind' is distinct from 'organization'
    )
    or (
      candidate_record.action in ('create_publication', 'update_publication', 'cancel_publication')
      and final_payload ->> 'kind' is distinct from 'publication'
    )
  then
    raise exception using errcode = '22023', message = 'Candidate payload does not match its action';
  end if;

  if candidate_record.action = 'create_organization' then
    if p_decision <> 'approve_publish' then
      raise exception using errcode = '22023', message = 'An organization can only be approved as active';
    end if;

    organization_name := nullif(btrim(coalesce(final_payload ->> 'name', '')), '');
    organization_description := nullif(btrim(coalesce(final_payload ->> 'description', '')), '');
    organization_phone := nullif(btrim(coalesce(final_payload ->> 'phone', '')), '');
    organization_type_id := nullif(final_payload ->> 'typeId', '')::uuid;

    select organization_type.id
      into organization_type_id
    from public.organization_types organization_type
    where (
        (organization_type_id is not null and organization_type.id = organization_type_id)
        or (
          organization_type_id is null
          and organization_type.slug = nullif(btrim(coalesce(final_payload ->> 'typeSlug', '')), '')
        )
      )
      and organization_type.is_active;

    if jsonb_typeof(coalesce(final_payload -> 'contactLinks', '[]'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = 'Organization contact links must be a JSON array';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(coalesce(final_payload -> 'contactLinks', '[]'::jsonb))
        as link(label text, href text)
      where nullif(btrim(coalesce(link.label, '')), '') is null
        or nullif(btrim(coalesce(link.href, '')), '') is null
    ) then
      raise exception using errcode = '22023', message = 'Organization contact link is incomplete';
    end if;

    select coalesce(jsonb_object_agg(link.label, link.href), '{}'::jsonb)
      into organization_contact_links
    from jsonb_to_recordset(coalesce(final_payload -> 'contactLinks', '[]'::jsonb))
      as link(label text, href text);

    if organization_name is null
      or char_length(organization_name) > 160
      or organization_description is null
      or organization_phone is null
    then
      raise exception using errcode = '22023', message = 'Required organization fields are incomplete';
    end if;

    if organization_type_id is null then
      raise exception using errcode = '22023', message = 'Active organization type not found';
    end if;

    insert into public.organizations (
      slug, name, description, status, address, phone, working_hours,
      contact_links, type_id, created_by, last_public_update_at
    )
    values (
      public.make_organization_slug(organization_name, candidate_record.id),
      organization_name,
      organization_description,
      'active',
      nullif(btrim(coalesce(final_payload ->> 'address', '')), ''),
      organization_phone,
      nullif(btrim(coalesce(final_payload ->> 'workingHours', '')), ''),
      organization_contact_links,
      organization_type_id,
      actor_id,
      now()
    )
    returning id into created_organization_id;

    update public.content_candidates dependent
    set target_organization_id = created_organization_id,
        updated_at = now()
    where dependent.depends_on_candidate_id = candidate_record.id
      and dependent.target_organization_id is null
      and dependent.status in ('pending', 'duplicate');
  elsif candidate_record.action in ('create_publication', 'update_publication') then
    saved_publication_id := public.save_imported_publication(
      candidate_record.id,
      candidate_record.action,
      final_payload,
      p_decision = 'approve_publish',
      actor_id,
      candidate_record.target_organization_id,
      candidate_record.target_publication_id,
      candidate_record.depends_on_candidate_id
    );
  elsif candidate_record.action = 'cancel_publication' then
    if p_decision <> 'approve_publish' then
      raise exception using errcode = '22023', message = 'Cancellation cannot be saved as a draft';
    end if;

    select evidence_entry ->> 'sourceUrl'
      into cancellation_source_url
    from jsonb_array_elements(candidate_record.evidence) evidence_entry
    where coalesce(evidence_entry ->> 'excerpt', '') ~* '(отмен|не состо|перенесен|перенесён)'
      and lower(coalesce(evidence_entry ->> 'sourceUrl', '')) like 'https://%'
    limit 1;

    if cancellation_source_url is null or lower(cancellation_source_url) not like 'https://%' then
      raise exception using errcode = '22023', message = 'Explicit primary cancellation source is required';
    end if;

    select publication.*
      into target_publication
    from public.publications publication
    where publication.id = candidate_record.target_publication_id
    for update;

    if target_publication.id is null then
      raise exception using errcode = '22023', message = 'Target publication not found';
    end if;
    if candidate_record.target_organization_id is not null
      and candidate_record.target_organization_id <> target_publication.organization_id
    then
      raise exception using errcode = '42501', message = 'Publication does not belong to the target organization';
    end if;
    if target_publication.status = 'published' then
      update public.publications
      set status = 'cancelled',
          cancelled_at = now(),
          publish_at = null,
          updated_at = now()
      where id = target_publication.id;
    elsif target_publication.status <> 'cancelled' then
      raise exception using errcode = '22023', message = 'Only a published publication can be cancelled';
    end if;

    saved_publication_id := target_publication.id;
  else
    raise exception using errcode = '22023', message = 'Unsupported content candidate action';
  end if;

  update public.content_candidates
  set payload = final_payload,
      status = 'approved',
      decision = p_decision,
      review_comment = normalized_comment,
      reviewed_by = actor_id,
      reviewed_at = now(),
      result_organization_id = created_organization_id,
      result_publication_id = saved_publication_id,
      updated_at = now()
  where id = candidate_record.id;

  return jsonb_build_object(
    'candidate_id', candidate_record.id,
    'status', 'approved',
    'decision', p_decision,
    'organization_id', created_organization_id,
    'publication_id', saved_publication_id,
    'idempotent', false
  );
end;
$$;

revoke all on function public.review_content_candidate(
  uuid, public.content_candidate_decision, jsonb, text
) from public, anon, authenticated, service_role;
grant execute on function public.review_content_candidate(
  uuid, public.content_candidate_decision, jsonb, text
) to authenticated;

create or replace function public.link_organization_application_to_existing(
  p_application_id uuid,
  p_organization_id uuid,
  p_admin_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  application_record public.organization_applications;
  organization_record public.organizations;
  member_id uuid;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select application.*
    into application_record
  from public.organization_applications application
  where application.id = p_application_id
  for update;

  if application_record.id is null then
    raise exception using errcode = '22023', message = 'Application not found';
  end if;

  if application_record.status = 'approved'
    and application_record.organization_id = p_organization_id
    and exists (
      select 1
      from public.organization_members member_record
      where member_record.organization_id = p_organization_id
        and member_record.user_id = application_record.applicant_id
        and member_record.role = 'owner'
        and member_record.is_active
    )
  then
    return jsonb_build_object(
      'application_id', application_record.id,
      'organization_id', p_organization_id,
      'status', 'approved',
      'idempotent', true
    );
  end if;

  if application_record.status <> 'submitted'
    or application_record.organization_id is not null
  then
    raise exception using errcode = '22023', message = 'Application cannot be linked from its current status';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));

  select organization.*
    into organization_record
  from public.organizations organization
  where organization.id = p_organization_id
  for update;

  if organization_record.id is null or organization_record.status <> 'active' then
    raise exception using errcode = '22023', message = 'Active organization not found';
  end if;

  if not exists (
    select 1
    from public.content_candidates imported_candidate
    where imported_candidate.action = 'create_organization'
      and imported_candidate.status = 'approved'
      and imported_candidate.result_organization_id = p_organization_id
  ) then
    raise exception using errcode = '22023', message = 'Organization was not created by the reviewed import workflow';
  end if;

  if exists (
    select 1
    from public.organization_members owner_record
    where owner_record.organization_id = p_organization_id
      and owner_record.role = 'owner'
      and owner_record.is_active
  ) then
    raise exception using errcode = '23505', message = 'Organization already has an active owner';
  end if;

  insert into public.organization_members (organization_id, user_id, role, is_active)
  values (p_organization_id, application_record.applicant_id, 'owner', true)
  on conflict (organization_id, user_id) do update
  set role = 'owner',
      is_active = true,
      updated_at = now()
  returning id into member_id;

  update public.organization_applications
  set organization_id = p_organization_id,
      status = 'approved',
      reviewed_by = actor_id,
      reviewed_at = now(),
      admin_comment = nullif(btrim(coalesce(p_admin_comment, '')), ''),
      updated_at = now()
  where id = application_record.id;

  return jsonb_build_object(
    'application_id', application_record.id,
    'organization_id', p_organization_id,
    'member_id', member_id,
    'status', 'approved',
    'idempotent', false
  );
end;
$$;

revoke all on function public.link_organization_application_to_existing(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.link_organization_application_to_existing(uuid, uuid, text)
  to authenticated;

create or replace function public.purge_expired_content_candidate_excerpts(p_batch_size integer default 500)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purged_count integer;
begin
  if p_batch_size < 1 or p_batch_size > 5000 then
    raise exception using errcode = '22023', message = 'Batch size must be between 1 and 5000';
  end if;

  with expired as (
    select candidate.id
    from public.content_candidates candidate
    where candidate.source_excerpt is not null
      and candidate.raw_expires_at <= now()
    order by candidate.raw_expires_at, candidate.id
    for update skip locked
    limit p_batch_size
  ), changed as (
    update public.content_candidates candidate
    set source_excerpt = null,
        updated_at = now()
    from expired
    where candidate.id = expired.id
    returning candidate.id
  )
  select count(*)::integer into purged_count from changed;

  return purged_count;
end;
$$;

revoke all on function public.purge_expired_content_candidate_excerpts(integer)
  from public, anon, authenticated;
grant execute on function public.purge_expired_content_candidate_excerpts(integer)
  to service_role;
