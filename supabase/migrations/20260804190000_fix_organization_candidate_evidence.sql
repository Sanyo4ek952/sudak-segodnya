-- Preserve verified primary-source evidence for dependency organization candidates.

with linked_evidence as (
  select distinct on (organization_candidate.id)
    organization_candidate.id as organization_candidate_id,
    publication_candidate.evidence
  from public.content_candidates organization_candidate
  join public.content_candidates publication_candidate
    on publication_candidate.depends_on_candidate_id = organization_candidate.id
   and publication_candidate.source_url = organization_candidate.source_url
  where organization_candidate.action = 'create_organization'
    and organization_candidate.status in ('pending', 'duplicate', 'stale', 'failed')
    and jsonb_typeof(organization_candidate.evidence) = 'array'
    and jsonb_array_length(organization_candidate.evidence) = 0
    and publication_candidate.payload ->> 'kind' = 'publication'
    and jsonb_typeof(publication_candidate.evidence) = 'array'
    and jsonb_array_length(publication_candidate.evidence) > 0
  order by organization_candidate.id, publication_candidate.created_at desc
)
update public.content_candidates organization_candidate
set evidence = linked_evidence.evidence
from linked_evidence
where organization_candidate.id = linked_evidence.organization_candidate_id;

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
    raise exception 'Для одобрения кандидата требуется проверенное доказательство из первичного источника.';
  end if;
  return new;
end;
$$;

revoke all on function public.require_content_candidate_evidence_before_publish() from public;

notify pgrst, 'reload schema';
