create or replace function public.create_inaccuracy_report(
  publication_id uuid,
  reason text,
  comment text,
  reporter_fingerprint text
)
returns public.inaccuracy_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_reason text := btrim(coalesce(create_inaccuracy_report.reason, ''));
  normalized_comment text := nullif(btrim(coalesce(create_inaccuracy_report.comment, '')), '');
  normalized_fingerprint text := nullif(btrim(coalesce(create_inaccuracy_report.reporter_fingerprint, '')), '');
  current_user_id uuid := auth.uid();
  inserted_report public.inaccuracy_reports;
begin
  if normalized_reason = '' then
    raise exception 'Report reason is required';
  end if;

  if length(normalized_reason) > 80 then
    raise exception 'Report reason is too long';
  end if;

  if normalized_comment is not null and length(normalized_comment) > 1000 then
    raise exception 'Report comment is too long';
  end if;

  if current_user_id is null and normalized_fingerprint is null then
    raise exception 'Reporter fingerprint is required';
  end if;

  if not exists (
    select 1
    from public.publications publication
    where publication.id = create_inaccuracy_report.publication_id
      and public.is_public_publication(publication)
  ) then
    raise exception 'Publication is not available for reports';
  end if;

  if exists (
    select 1
    from public.inaccuracy_reports report
    where report.publication_id = create_inaccuracy_report.publication_id
      and report.reason = normalized_reason
      and (
        (current_user_id is not null and report.reporter_user_id = current_user_id)
        or (current_user_id is null and report.reporter_fingerprint = normalized_fingerprint)
      )
  ) then
    raise exception 'Duplicate report';
  end if;

  if (
    select count(*)
    from public.inaccuracy_reports report
    where report.created_at >= now() - interval '1 hour'
      and (
        (current_user_id is not null and report.reporter_user_id = current_user_id)
        or (current_user_id is null and report.reporter_fingerprint = normalized_fingerprint)
      )
  ) >= 3 then
    raise exception 'Too many reports';
  end if;

  insert into public.inaccuracy_reports (
    publication_id,
    reporter_user_id,
    reporter_fingerprint,
    reason,
    comment,
    status
  )
  values (
    create_inaccuracy_report.publication_id,
    current_user_id,
    case when current_user_id is null then normalized_fingerprint else normalized_fingerprint end,
    normalized_reason,
    normalized_comment,
    'new'
  )
  returning * into inserted_report;

  return inserted_report;
end;
$$;

revoke all on function public.create_inaccuracy_report(uuid, text, text, text) from public;
grant execute on function public.create_inaccuracy_report(uuid, text, text, text) to anon, authenticated;
