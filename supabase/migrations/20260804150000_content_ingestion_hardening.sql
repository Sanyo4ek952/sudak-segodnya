-- Close audit visibility gaps and require verified evidence before public approval.

drop policy if exists "Authorized users can read audit events"
  on public.audit_events;

create policy "Authorized users can read audit events"
on public.audit_events
for select
to authenticated
using (
  public.is_admin()
  or (
    organization_id is not null
    and entity_type not in ('content_candidates', 'content_sources', 'content_ingestion_runs')
    and public.is_org_owner(organization_id)
  )
  or (
    entity_type = 'organization_applications'
    and exists (
      select 1
      from public.organization_applications application
      where application.id = entity_id
        and application.applicant_id = auth.uid()
    )
  )
);

update public.audit_events
set organization_id = null
where entity_type in ('content_candidates', 'content_sources', 'content_ingestion_runs')
  and organization_id is not null;

create or replace function public.require_content_candidate_evidence_before_publish()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved'
     and new.decision = 'approve_publish'
     and (
       jsonb_typeof(new.evidence) is distinct from 'array'
       or jsonb_array_length(new.evidence) = 0
     ) then
    raise exception 'Для публикации требуется проверенное доказательство из первичного источника.';
  end if;
  return new;
end;
$$;

revoke all on function public.require_content_candidate_evidence_before_publish() from public;

drop trigger if exists require_content_candidate_evidence_before_publish_trigger
  on public.content_candidates;
create trigger require_content_candidate_evidence_before_publish_trigger
before update of status, decision on public.content_candidates
for each row execute function public.require_content_candidate_evidence_before_publish();

notify pgrst, 'reload schema';
