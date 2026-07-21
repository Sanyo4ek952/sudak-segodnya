insert into public.organization_types (slug, name, sort_order)
values ('services', 'Услуги', 80)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;

update public.organizations organization_record
set type_id = organization_type.id
from public.organization_types organization_type
where organization_record.type_id is null
  and organization_type.slug = 'services';

alter table public.organizations
  alter column type_id set not null;

alter table public.organizations
  drop constraint if exists organizations_active_has_required_public_fields,
  add constraint organizations_active_has_required_public_fields check (
    status <> 'active'
    or (
      nullif(btrim(coalesce(description, '')), '') is not null
      and nullif(btrim(coalesce(phone, '')), '') is not null
    )
  );

alter table public.publications
  drop constraint if exists publications_published_has_content,
  add constraint publications_public_status_has_required_fields check (
    status not in ('published', 'cancelled')
    or (
      category_id is not null
      and nullif(btrim(coalesce(description, '')), '') is not null
      and nullif(btrim(coalesce(price_text, '')), '') is not null
      and (
        (type = 'event' and starts_at is not null and ends_at is not null)
        or (type in ('announcement', 'promo', 'regular') and valid_until is not null)
        or type = 'news'
      )
    )
  );

alter table public.media_assets
  drop constraint if exists media_assets_bucket_matches_purpose,
  add constraint media_assets_bucket_matches_purpose check (
    (purpose in ('organization_logo', 'organization_cover') and bucket_id = 'organization-images')
    or (purpose = 'application_confirmation' and bucket_id = 'application-confirmation-images')
    or (purpose = 'publication_photo' and bucket_id = 'publication-images')
    or (purpose = 'menu_item_photo' and bucket_id = 'menu-images')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('organization-images', 'organization-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('publication-images', 'publication-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('menu-images', 'menu-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('application-confirmation-images', 'application-confirmation-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_media_asset(asset public.media_assets)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (
      asset.organization_id is not null
      and public.is_org_member(asset.organization_id)
    )
    or (
      asset.application_id is not null
      and exists (
        select 1
        from public.organization_applications application
        where application.id = asset.application_id
          and application.applicant_id = auth.uid()
          and application.status in ('draft', 'needs_changes')
      )
    )
    or (
      asset.publication_id is not null
      and exists (
        select 1
        from public.publications publication
        where publication.id = asset.publication_id
          and public.is_org_member(publication.organization_id)
      )
    )
    or (
      asset.menu_item_id is not null
      and exists (
        select 1
        from public.menu_items item
        where item.id = asset.menu_item_id
          and public.is_org_member(item.organization_id)
      )
    );
$$;

create or replace function public.can_read_private_application_media_asset(asset public.media_assets)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (
      asset.application_id is not null
      and asset.purpose = 'application_confirmation'
      and asset.visibility = 'private'
      and exists (
        select 1
        from public.organization_applications application
        where application.id = asset.application_id
          and application.applicant_id = auth.uid()
      )
    );
$$;

drop policy if exists "Applicants can manage own application media assets" on public.media_assets;
drop policy if exists "Members can manage organization media assets" on public.media_assets;
drop policy if exists "Authenticated users can manage allowed media assets" on public.media_assets;

create policy "Authenticated users can manage allowed media assets"
on public.media_assets
for all
to authenticated
using (
  deleted_at is null
  and public.can_manage_media_asset(media_assets)
)
with check (
  public.is_admin()
  or (
    uploaded_by = auth.uid()
    and public.can_manage_media_asset(media_assets)
  )
);

drop policy if exists "Applicants can read private app storage objects" on storage.objects;
drop policy if exists "Members and admins can update linked media storage objects" on storage.objects;
drop policy if exists "Members and admins can delete linked media storage objects" on storage.objects;

create policy "Applicants can read private app storage objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'application-confirmation-images'
  and exists (
    select 1
    from public.media_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.storage_path = storage.objects.name
      and asset.deleted_at is null
      and public.can_read_private_application_media_asset(asset)
  )
);

create policy "Members and admins can update linked media storage objects"
on storage.objects
for update
to authenticated
using (
  exists (
    select 1
    from public.media_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.storage_path = storage.objects.name
      and asset.deleted_at is null
      and public.can_manage_media_asset(asset)
  )
)
with check (
  exists (
    select 1
    from public.media_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.storage_path = storage.objects.name
      and asset.deleted_at is null
      and public.can_manage_media_asset(asset)
  )
);

create policy "Members and admins can delete linked media storage objects"
on storage.objects
for delete
to authenticated
using (
  exists (
    select 1
    from public.media_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.storage_path = storage.objects.name
      and asset.deleted_at is null
      and public.can_manage_media_asset(asset)
  )
);

create or replace function public.submit_organization_application(application_id uuid)
returns public.organization_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  submitted_application public.organization_applications;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  update public.organization_applications
  set status = 'submitted',
      submitted_at = coalesce(submitted_at, now())
  where id = application_id
    and applicant_id = auth.uid()
    and status in ('draft', 'needs_changes')
    and organization_id is null
    and nullif(btrim(coalesce(organization_name, '')), '') is not null
    and type_id is not null
    and nullif(btrim(coalesce(description, '')), '') is not null
    and nullif(btrim(coalesce(phone, '')), '') is not null
    and nullif(btrim(coalesce(relationship, '')), '') is not null
  returning * into submitted_application;

  if submitted_application.id is null then
    raise exception 'Application cannot be submitted';
  end if;

  return submitted_application;
end;
$$;

create or replace function public.approve_organization_application(application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_application public.organization_applications;
  created_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_admin() then
    raise exception 'Only administrators can approve applications';
  end if;

  select *
  into locked_application
  from public.organization_applications
  where id = approve_organization_application.application_id
  for update;

  if locked_application.id is null then
    raise exception 'Application not found';
  end if;

  if locked_application.status <> 'submitted' then
    raise exception 'Application cannot be approved from current status';
  end if;

  if locked_application.organization_id is not null then
    raise exception 'Application is already linked to an organization';
  end if;

  if nullif(btrim(coalesce(locked_application.organization_name, '')), '') is null
    or locked_application.type_id is null
    or nullif(btrim(coalesce(locked_application.description, '')), '') is null
    or nullif(btrim(coalesce(locked_application.phone, '')), '') is null then
    raise exception 'Application has incomplete organization data';
  end if;

  insert into public.organizations (
    slug,
    name,
    description,
    status,
    address,
    phone,
    type_id,
    created_by
  )
  values (
    public.make_organization_slug(locked_application.organization_name, locked_application.id),
    btrim(locked_application.organization_name),
    btrim(locked_application.description),
    'active',
    nullif(btrim(coalesce(locked_application.address, '')), ''),
    btrim(locked_application.phone),
    locked_application.type_id,
    locked_application.applicant_id
  )
  returning id into created_organization_id;

  insert into public.organization_members (organization_id, user_id, role, is_active)
  values (created_organization_id, locked_application.applicant_id, 'owner', true);

  update public.organization_applications
  set organization_id = created_organization_id,
      status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_comment = null
  where id = locked_application.id;

  return jsonb_build_object(
    'application_id', locked_application.id,
    'organization_id', created_organization_id,
    'status', 'approved'
  );
end;
$$;

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
  normalized_reason public.inaccuracy_report_reason := case btrim(coalesce(create_inaccuracy_report.reason, ''))
    when 'wrong_datetime' then 'wrong_datetime'::public.inaccuracy_report_reason
    when 'wrong_price' then 'wrong_price'::public.inaccuracy_report_reason
    when 'cancelled' then 'cancelled'::public.inaccuracy_report_reason
    when 'wrong_address' then 'wrong_address'::public.inaccuracy_report_reason
    when 'outdated' then 'outdated'::public.inaccuracy_report_reason
    when 'other' then 'other'::public.inaccuracy_report_reason
    else null
  end;
  normalized_comment text := nullif(btrim(coalesce(create_inaccuracy_report.comment, '')), '');
  normalized_fingerprint text := nullif(btrim(coalesce(create_inaccuracy_report.reporter_fingerprint, '')), '');
  current_user_id uuid := auth.uid();
  inserted_report public.inaccuracy_reports;
begin
  if normalized_reason is null then
    raise exception 'Report reason is invalid';
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
    normalized_fingerprint,
    normalized_reason,
    normalized_comment,
    'new'
  )
  returning * into inserted_report;

  return inserted_report;
end;
$$;

revoke all on function public.create_inaccuracy_report(uuid, text, text, text) from public;
grant execute on function public.can_manage_media_asset(public.media_assets) to authenticated;
grant execute on function public.can_read_private_application_media_asset(public.media_assets) to authenticated;
grant execute on function public.create_inaccuracy_report(uuid, text, text, text) to anon, authenticated;
