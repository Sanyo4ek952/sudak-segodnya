-- Production hardening for the reviewed content-ingestion workflow.
-- Keeps source diagnostics, permits unresolved update candidates in the closed
-- queue, and adds guarded draft/final review operations for administrators.

alter table public.content_sources
  add column if not exists adapter_id text,
  add column if not exists extraction_format text,
  add column if not exists last_tested_at timestamptz;

alter table public.content_sources
  drop constraint if exists content_sources_adapter_id_length,
  add constraint content_sources_adapter_id_length check (
    adapter_id is null or char_length(adapter_id) between 1 and 120
  ),
  drop constraint if exists content_sources_extraction_format,
  add constraint content_sources_extraction_format check (
    extraction_format is null
    or extraction_format in ('rss', 'json_ld', 'adapter', 'unknown')
  );

alter table public.content_ingestion_runs
  add column if not exists adapter_id text,
  add column if not exists extraction_format text,
  add column if not exists final_url text;

alter table public.content_ingestion_runs
  drop constraint if exists content_ingestion_runs_adapter_id_length,
  add constraint content_ingestion_runs_adapter_id_length check (
    adapter_id is null or char_length(adapter_id) between 1 and 120
  ),
  drop constraint if exists content_ingestion_runs_extraction_format,
  add constraint content_ingestion_runs_extraction_format check (
    extraction_format is null
    or extraction_format in ('rss', 'json_ld', 'adapter', 'unknown')
  ),
  drop constraint if exists content_ingestion_runs_final_url_https,
  add constraint content_ingestion_runs_final_url_https check (
    final_url is null or lower(final_url) like 'https://%'
  );

-- The reviewed payload can be corrected by an administrator. Keep a separate
-- immutable-by-workflow fingerprint of what the source actually returned so a
-- later source change can become an update instead of another publication.
alter table public.content_candidates
  add column if not exists source_version_hash text;

alter table public.content_candidates
  drop constraint if exists content_candidates_source_version_hash_not_empty,
  add constraint content_candidates_source_version_hash_not_empty check (
    source_version_hash is null or nullif(btrim(source_version_hash), '') is not null
  );

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
      or new.source_version_hash is distinct from old.source_version_hash
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

-- An update/cancellation candidate is useful even when automatic target
-- resolution failed. It stays private until an administrator selects a target.
alter table public.content_candidates
  drop constraint if exists content_candidates_target_matches_action;

alter table public.content_candidates
  add constraint content_candidates_target_matches_action check (
    (action in ('create_organization', 'create_publication') and target_publication_id is null)
    or (
      action in ('update_publication', 'cancel_publication')
      and (
        status <> 'approved'
        or (
          target_publication_id is not null
          and nullif(payload ->> 'targetPublicationId', '') is not null
        )
      )
    )
  );

create or replace function public.save_content_candidate_draft(
  p_candidate_id uuid,
  p_payload jsonb,
  p_expected_updated_at timestamptz,
  p_target_organization_id uuid default null,
  p_target_publication_id uuid default null,
  p_dependency_candidate_id uuid default null,
  p_dependency_payload jsonb default null,
  p_dependency_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  candidate_record public.content_candidates;
  dependency_record public.content_candidates;
  organization_record public.organizations;
  publication_record public.publications;
  candidate_updated_at timestamptz;
  dependency_updated_at timestamptz;
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

  -- A linked organization is always locked before its publication. This is the
  -- same order used by the combined final-review operation.
  if p_dependency_candidate_id is not null then
    if candidate_record.depends_on_candidate_id is distinct from p_dependency_candidate_id then
      raise exception using errcode = '22023', message = 'Publication dependency changed';
    end if;

    select candidate.*
      into dependency_record
    from public.content_candidates candidate
    where candidate.id = p_dependency_candidate_id
    for update;
  end if;

  select candidate.*
    into candidate_record
  from public.content_candidates candidate
  where candidate.id = p_candidate_id
  for update;

  if candidate_record.status not in ('pending', 'duplicate') then
    raise exception using errcode = '22023', message = 'Candidate is no longer editable';
  end if;
  if candidate_record.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Candidate was changed by another administrator';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
    or (
      candidate_record.action = 'create_organization'
      and p_payload ->> 'kind' is distinct from 'organization'
    )
    or (
      candidate_record.action in ('create_publication', 'update_publication', 'cancel_publication')
      and p_payload ->> 'kind' is distinct from 'publication'
    )
  then
    raise exception using errcode = '22023', message = 'Candidate payload does not match its action';
  end if;

  if p_dependency_candidate_id is null and p_dependency_payload is not null then
    raise exception using errcode = '22023', message = 'Organization dependency is required for its payload';
  end if;
  if p_dependency_payload is not null and p_target_organization_id is not null then
    raise exception using errcode = '22023', message = 'Select either an existing or a new organization';
  end if;

  if candidate_record.action = 'create_organization' then
    if p_target_organization_id is not null or p_target_publication_id is not null then
      raise exception using errcode = '22023', message = 'Organization candidate cannot have a target entity';
    end if;
  else
    if nullif(p_payload ->> 'organizationId', '') is distinct from p_target_organization_id::text then
      raise exception using errcode = '22023', message = 'Payload organization does not match the selected organization';
    end if;
    if nullif(p_payload ->> 'targetPublicationId', '') is distinct from p_target_publication_id::text then
      raise exception using errcode = '22023', message = 'Payload publication does not match the selected publication';
    end if;
    if candidate_record.action = 'create_publication' and p_target_publication_id is not null then
      raise exception using errcode = '22023', message = 'New publication cannot target an existing publication';
    end if;

    if p_target_organization_id is not null then
      select organization.*
        into organization_record
      from public.organizations organization
      where organization.id = p_target_organization_id
        and organization.status = 'active';
      if organization_record.id is null then
        raise exception using errcode = '22023', message = 'Active organization not found';
      end if;
    end if;

    if candidate_record.action in ('update_publication', 'cancel_publication')
      and p_target_publication_id is not null
    then
      select publication.*
        into publication_record
      from public.publications publication
      where publication.id = p_target_publication_id;
      if publication_record.id is null then
        raise exception using errcode = '22023', message = 'Target publication not found';
      end if;
      if p_target_organization_id is not null
        and publication_record.organization_id <> p_target_organization_id
      then
        raise exception using errcode = '42501', message = 'Publication does not belong to the target organization';
      end if;
    end if;
  end if;

  if p_dependency_candidate_id is not null then
    if candidate_record.depends_on_candidate_id is distinct from p_dependency_candidate_id then
      raise exception using errcode = '22023', message = 'Publication dependency changed';
    end if;

    if dependency_record.id is null
      or dependency_record.action <> 'create_organization'
      or dependency_record.status not in ('pending', 'duplicate')
    then
      raise exception using errcode = '22023', message = 'Organization candidate is no longer editable';
    end if;
    if dependency_record.updated_at is distinct from p_dependency_expected_updated_at then
      raise exception using errcode = '40001', message = 'Organization candidate was changed by another administrator';
    end if;

    if p_dependency_payload is not null then
      if jsonb_typeof(p_dependency_payload) is distinct from 'object'
        or p_dependency_payload ->> 'kind' is distinct from 'organization'
      then
        raise exception using errcode = '22023', message = 'Organization payload is invalid';
      end if;

      update public.content_candidates
      set payload = p_dependency_payload,
          status = 'pending',
          duplicate_of_id = null,
          duplicate_organization_id = null,
          duplicate_publication_id = null,
          duplicate_reviewed_by = case
            when dependency_record.status = 'duplicate' then actor_id
            else duplicate_reviewed_by
          end,
          duplicate_reviewed_at = case
            when dependency_record.status = 'duplicate' then now()
            else duplicate_reviewed_at
          end,
          updated_at = now()
      where id = dependency_record.id
      returning updated_at into dependency_updated_at;
    elsif p_target_organization_id is not null then
      update public.content_candidates
      set status = 'duplicate',
          duplicate_organization_id = p_target_organization_id,
          duplicate_of_id = null,
          duplicate_publication_id = null,
          duplicate_reviewed_by = actor_id,
          duplicate_reviewed_at = now(),
          updated_at = now()
      where id = dependency_record.id
      returning updated_at into dependency_updated_at;
    end if;
  end if;

  update public.content_candidates
  set payload = p_payload,
      target_organization_id = p_target_organization_id,
      target_publication_id = p_target_publication_id,
      updated_at = now()
  where id = candidate_record.id
  returning updated_at into candidate_updated_at;

  return jsonb_build_object(
    'candidate_id', candidate_record.id,
    'updated_at', candidate_updated_at,
    'dependency_candidate_id', p_dependency_candidate_id,
    'dependency_updated_at', dependency_updated_at
  );
end;
$$;

revoke all on function public.save_content_candidate_draft(
  uuid, jsonb, timestamptz, uuid, uuid, uuid, jsonb, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.save_content_candidate_draft(
  uuid, jsonb, timestamptz, uuid, uuid, uuid, jsonb, timestamptz
) to authenticated;

create or replace function public.review_content_candidate_guarded(
  p_candidate_id uuid,
  p_decision public.content_candidate_decision,
  p_payload jsonb,
  p_review_comment text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  candidate_record public.content_candidates;
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
  if candidate_record.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Candidate was changed by another administrator';
  end if;

  if candidate_record.status = 'duplicate' and p_decision <> 'mark_not_duplicate' then
    perform public.review_content_candidate(
      p_candidate_id,
      'mark_not_duplicate',
      null,
      null
    );
  end if;

  return public.review_content_candidate(
    p_candidate_id,
    p_decision,
    p_payload,
    p_review_comment
  );
end;
$$;

revoke all on function public.review_content_candidate_guarded(
  uuid, public.content_candidate_decision, jsonb, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.review_content_candidate_guarded(
  uuid, public.content_candidate_decision, jsonb, text, timestamptz
) to authenticated;

create or replace function public.review_content_candidate_with_organization_guarded(
  p_candidate_id uuid,
  p_decision public.content_candidate_decision,
  p_payload jsonb,
  p_review_comment text,
  p_expected_updated_at timestamptz,
  p_organization_candidate_id uuid,
  p_organization_payload jsonb,
  p_organization_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  publication_candidate public.content_candidates;
  organization_candidate public.content_candidates;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  -- Preserve the established lock order: organization, then publication.
  select candidate.*
    into organization_candidate
  from public.content_candidates candidate
  where candidate.id = p_organization_candidate_id
  for update;

  select candidate.*
    into publication_candidate
  from public.content_candidates candidate
  where candidate.id = p_candidate_id
  for update;

  if organization_candidate.id is null or publication_candidate.id is null then
    raise exception using errcode = '22023', message = 'Linked candidates were not found';
  end if;
  if publication_candidate.depends_on_candidate_id is distinct from organization_candidate.id then
    raise exception using errcode = '22023', message = 'Publication dependency changed';
  end if;
  if organization_candidate.updated_at is distinct from p_organization_expected_updated_at
    or publication_candidate.updated_at is distinct from p_expected_updated_at
  then
    raise exception using errcode = '40001', message = 'Candidate was changed by another administrator';
  end if;

  if organization_candidate.status = 'duplicate' then
    perform public.review_content_candidate(
      organization_candidate.id,
      'mark_not_duplicate',
      null,
      null
    );
  end if;
  if publication_candidate.status = 'duplicate' then
    perform public.review_content_candidate(
      publication_candidate.id,
      'mark_not_duplicate',
      null,
      null
    );
  end if;

  return public.review_content_candidate_with_organization(
    p_candidate_id,
    p_decision,
    p_payload,
    p_organization_candidate_id,
    p_organization_payload,
    p_review_comment
  );
end;
$$;

revoke all on function public.review_content_candidate_with_organization_guarded(
  uuid, public.content_candidate_decision, jsonb, text, timestamptz,
  uuid, jsonb, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.review_content_candidate_with_organization_guarded(
  uuid, public.content_candidate_decision, jsonb, text, timestamptz,
  uuid, jsonb, timestamptz
) to authenticated;

notify pgrst, 'reload schema';
