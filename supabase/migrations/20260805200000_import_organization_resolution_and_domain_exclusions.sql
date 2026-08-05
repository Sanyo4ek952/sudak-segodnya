-- Let administrators explicitly create a missing organization together with an
-- imported publication, and keep a reversible domain denylist for ingestion.

create table public.content_ingestion_domain_exclusions (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint content_ingestion_domain_exclusions_domain_normalized check (
    domain = lower(btrim(domain))
    and domain !~ '^www\.'
    and char_length(domain) between 3 and 253
    and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  )
);

alter table public.content_ingestion_domain_exclusions enable row level security;

create policy "Admins can read ingestion domain exclusions"
on public.content_ingestion_domain_exclusions for select to authenticated
using (public.is_admin());

create policy "Admins can create ingestion domain exclusions"
on public.content_ingestion_domain_exclusions for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy "Admins can delete ingestion domain exclusions"
on public.content_ingestion_domain_exclusions for delete to authenticated
using (public.is_admin());

revoke all on table public.content_ingestion_domain_exclusions
  from public, anon, authenticated;
grant select, insert, delete on table public.content_ingestion_domain_exclusions
  to authenticated;
grant select, insert, update, delete on table public.content_ingestion_domain_exclusions
  to service_role;

create trigger audit_content_ingestion_domain_exclusions
after insert or update or delete on public.content_ingestion_domain_exclusions
for each row execute function public.write_content_ingestion_audit_event();

create or replace function public.content_source_hostname(p_url text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select regexp_replace(
    trim(trailing '.' from lower(split_part(split_part(split_part(p_url, '://', 2), '/', 1), ':', 1))),
    '^www\.',
    ''
  );
$$;

revoke all on function public.content_source_hostname(text)
  from public, anon, authenticated;
grant execute on function public.content_source_hostname(text) to service_role;

create or replace function public.reject_excluded_content_ingestion_domain()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_url text := coalesce(
    to_jsonb(new) ->> 'source_url',
    to_jsonb(new) ->> 'canonical_url'
  );
  source_host text := public.content_source_hostname(source_url);
begin
  if exists (
    select 1
    from public.content_ingestion_domain_exclusions exclusion
    where source_host = exclusion.domain
      or source_host like '%.' || exclusion.domain
  ) then
    raise exception using errcode = '22023', message = 'Source domain is excluded from content ingestion';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_excluded_content_ingestion_domain()
  from public, anon, authenticated;

create trigger reject_excluded_content_source_domain
before insert or update of canonical_url on public.content_sources
for each row execute function public.reject_excluded_content_ingestion_domain();

create trigger reject_excluded_content_candidate_domain
before insert or update of source_url on public.content_candidates
for each row execute function public.reject_excluded_content_ingestion_domain();

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
      and not exists (
        select 1
        from public.content_ingestion_domain_exclusions exclusion
        where public.content_source_hostname(source.canonical_url) = exclusion.domain
          or public.content_source_hostname(source.canonical_url) like '%.' || exclusion.domain
      )
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

create or replace function public.review_content_candidate_with_organization(
  p_candidate_id uuid,
  p_decision public.content_candidate_decision,
  p_payload jsonb,
  p_organization_candidate_id uuid,
  p_organization_payload jsonb,
  p_review_comment text default null
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
  organization_result jsonb;
  publication_result jsonb;
begin
  if actor_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  if p_decision not in ('approve_publish', 'approve_draft') then
    raise exception using errcode = '22023', message = 'Unsupported combined review decision';
  end if;

  select candidate.*
    into publication_candidate
  from public.content_candidates candidate
  where candidate.id = p_candidate_id;

  if publication_candidate.id is null
    or publication_candidate.action <> 'create_publication'
    or publication_candidate.depends_on_candidate_id is distinct from p_organization_candidate_id
  then
    raise exception using errcode = '22023', message = 'Publication does not depend on this organization candidate';
  end if;

  -- Keep the same lock order as standalone organization review: organization,
  -- then its dependent publication.
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

  if organization_candidate.id is null
    or organization_candidate.action <> 'create_organization'
    or organization_candidate.status not in ('pending', 'approved')
  then
    raise exception using errcode = '22023', message = 'Organization candidate cannot be approved';
  end if;

  if publication_candidate.action <> 'create_publication'
    or publication_candidate.depends_on_candidate_id is distinct from organization_candidate.id
  then
    raise exception using errcode = '22023', message = 'Publication dependency changed during review';
  end if;

  organization_result := public.review_content_candidate(
    organization_candidate.id,
    'approve_publish',
    p_organization_payload,
    p_review_comment
  );

  publication_result := public.review_content_candidate(
    publication_candidate.id,
    p_decision,
    p_payload || jsonb_build_object(
      'organizationId', organization_result ->> 'organization_id'
    ),
    p_review_comment
  );

  return publication_result || jsonb_build_object(
    'organization_candidate_id', organization_candidate.id,
    'organization_id', organization_result ->> 'organization_id'
  );
end;
$$;

revoke all on function public.review_content_candidate_with_organization(
  uuid, public.content_candidate_decision, jsonb, uuid, jsonb, text
) from public, anon, authenticated, service_role;
grant execute on function public.review_content_candidate_with_organization(
  uuid, public.content_candidate_decision, jsonb, uuid, jsonb, text
) to authenticated;

notify pgrst, 'reload schema';
