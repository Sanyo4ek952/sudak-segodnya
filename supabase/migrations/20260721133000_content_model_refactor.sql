do $$
begin
  create type public.media_asset_purpose as enum (
    'organization_logo',
    'organization_cover',
    'application_confirmation',
    'publication_photo',
    'menu_item_photo'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.media_asset_visibility as enum ('public', 'private');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.inaccuracy_report_reason as enum (
    'wrong_datetime',
    'wrong_price',
    'cancelled',
    'wrong_address',
    'outdated',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.analytics_event_name as enum (
    'organization_view',
    'publication_view',
    'phone_click',
    'route_click',
    'menu_open',
    'favorite_add'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.organization_types') is null
    and to_regclass('public.organization_categories') is not null then
    alter table public.organization_categories rename to organization_types;
  end if;
end $$;

create table if not exists public.organization_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_types_slug_not_empty check (length(btrim(slug)) > 0),
  constraint organization_types_name_not_empty check (length(btrim(name)) > 0)
);

alter table public.organization_types
  drop constraint if exists organization_categories_slug_not_empty,
  drop constraint if exists organization_categories_name_not_empty;

insert into public.organization_types (slug, name, sort_order)
values
  ('food', 'Рестораны и кафе', 10),
  ('delivery', 'Доставка', 20),
  ('kids', 'Кружки и секции', 30),
  ('culture', 'Культура', 40),
  ('excursions', 'Экскурсии', 50),
  ('rental_entertainment', 'Прокат и развлечения', 60),
  ('shops', 'Магазины', 70),
  ('services', 'Услуги', 80),
  ('administration', 'Администрация', 90)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'category_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'type_id'
  ) then
    alter table public.organizations rename column category_id to type_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organization_applications' and column_name = 'category_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organization_applications' and column_name = 'type_id'
  ) then
    alter table public.organization_applications rename column category_id to type_id;
  end if;
end $$;

update public.organizations organization_record
set type_id = target_type.id
from public.organization_types source_type,
     public.organization_types target_type
where organization_record.type_id = source_type.id
  and source_type.slug = 'rental'
  and target_type.slug = 'rental_entertainment';

update public.organization_applications application
set type_id = target_type.id
from public.organization_types source_type,
     public.organization_types target_type
where application.type_id = source_type.id
  and source_type.slug = 'rental'
  and target_type.slug = 'rental_entertainment';

update public.organization_types
set is_active = false,
    sort_order = 999
where slug = 'rental';

alter table public.organizations
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);

create table if not exists public.publication_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_categories_slug_not_empty check (length(btrim(slug)) > 0),
  constraint publication_categories_name_not_empty check (length(btrim(name)) > 0)
);

insert into public.publication_categories (slug, name, sort_order)
values
  ('city', 'Город', 10),
  ('kids', 'Детям', 20),
  ('food', 'Еда', 30),
  ('culture', 'Культура', 40),
  ('sport', 'Спорт и кружки', 50),
  ('excursions', 'Экскурсии', 60),
  ('rental', 'Прокат', 70),
  ('shops', 'Магазины', 80),
  ('services', 'Услуги', 90)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;

alter table public.publications
  add column if not exists category_id uuid references public.publication_categories(id);

update public.publications publication
set category_id = category.id
from public.publication_categories category
where publication.category_id is null
  and category.slug = publication.category_slug;

update public.publications publication
set category_id = category.id
from public.publication_categories category
where publication.category_id is null
  and category.slug = 'services';

alter table public.publications
  alter column category_id set not null;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  storage_path text not null,
  purpose public.media_asset_purpose not null,
  visibility public.media_asset_visibility not null default 'public',
  organization_id uuid references public.organizations(id) on delete cascade,
  application_id uuid references public.organization_applications(id) on delete cascade,
  publication_id uuid references public.publications(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  alt_text text,
  width integer,
  height integer,
  mime_type text,
  size_bytes bigint,
  sort_order integer not null default 0,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_storage_path_not_empty check (length(btrim(storage_path)) > 0),
  constraint media_assets_one_owner check (
    ((organization_id is not null)::int
      + (application_id is not null)::int
      + (publication_id is not null)::int
      + (menu_item_id is not null)::int) = 1
  ),
  constraint media_assets_owner_matches_purpose check (
    (purpose in ('organization_logo', 'organization_cover') and organization_id is not null)
    or (purpose = 'application_confirmation' and application_id is not null and visibility = 'private')
    or (purpose = 'publication_photo' and publication_id is not null)
    or (purpose = 'menu_item_photo' and menu_item_id is not null)
  ),
  constraint media_assets_dimensions_positive check (
    (width is null or width > 0)
    and (height is null or height > 0)
    and (size_bytes is null or size_bytes > 0)
  )
);

insert into public.media_assets (
  bucket_id,
  storage_path,
  purpose,
  visibility,
  organization_id,
  uploaded_by,
  sort_order
)
select
  'organization-images',
  logo_path,
  'organization_logo',
  'public',
  id,
  created_by,
  0
from public.organizations
where logo_path is not null
on conflict do nothing;

insert into public.media_assets (
  bucket_id,
  storage_path,
  purpose,
  visibility,
  organization_id,
  uploaded_by,
  sort_order
)
select
  'organization-images',
  cover_path,
  'organization_cover',
  'public',
  id,
  created_by,
  0
from public.organizations
where cover_path is not null
on conflict do nothing;

insert into public.media_assets (
  bucket_id,
  storage_path,
  purpose,
  visibility,
  publication_id,
  uploaded_by,
  sort_order
)
select
  'publication-images',
  image_path,
  'publication_photo',
  'public',
  id,
  author_id,
  0
from public.publications
where image_path is not null
on conflict do nothing;

insert into public.media_assets (
  bucket_id,
  storage_path,
  purpose,
  visibility,
  menu_item_id,
  uploaded_by,
  sort_order
)
select
  'menu-images',
  image_path,
  'menu_item_photo',
  'public',
  id,
  auth.uid(),
  0
from public.menu_items
where image_path is not null
  and auth.uid() is not null
on conflict do nothing;

alter table public.analytics_events
  drop constraint if exists analytics_events_name_allowed;

alter table public.analytics_events
  alter column event_name type public.analytics_event_name
  using event_name::public.analytics_event_name;

alter table public.inaccuracy_reports
  drop constraint if exists inaccuracy_reports_reason_not_empty;

alter table public.inaccuracy_reports
  alter column reason type public.inaccuracy_report_reason
  using case
    when reason in ('wrong_datetime', 'wrong_price', 'cancelled', 'wrong_address', 'outdated', 'other')
      then reason::public.inaccuracy_report_reason
    else 'other'::public.inaccuracy_report_reason
  end;

drop policy if exists "Public can read approved organization images" on storage.objects;
drop policy if exists "Public can read approved publication images" on storage.objects;
drop policy if exists "Public can read approved menu images" on storage.objects;
drop policy if exists "Members can upload organization images" on storage.objects;
drop policy if exists "Members can upload publication images" on storage.objects;
drop policy if exists "Members can upload menu images" on storage.objects;

alter table public.publications
  drop column if exists category_slug,
  drop column if exists image_path;

alter table public.organizations
  drop column if exists logo_path,
  drop column if exists cover_path;

alter table public.menu_items
  drop column if exists image_path;

alter table public.organization_applications
  drop column if exists category_name;

drop policy if exists "Public can read active organization categories" on public.organization_types;
drop policy if exists "Public can read active publication categories" on public.publication_categories;
drop policy if exists "Public can read approved organization images" on storage.objects;
drop policy if exists "Public can read approved publication images" on storage.objects;
drop policy if exists "Public can read approved menu images" on storage.objects;
drop policy if exists "Members can upload organization images" on storage.objects;
drop policy if exists "Members can upload publication images" on storage.objects;
drop policy if exists "Members can upload menu images" on storage.objects;

create index if not exists organization_types_active_sort_idx
  on public.organization_types(is_active, sort_order);
create index if not exists organizations_status_type_idx
  on public.organizations(status, type_id);
create index if not exists organization_applications_type_idx
  on public.organization_applications(type_id);
create index if not exists publication_categories_active_sort_idx
  on public.publication_categories(is_active, sort_order);
create index if not exists publications_category_status_idx
  on public.publications(category_id, status);
create index if not exists media_assets_organization_purpose_idx
  on public.media_assets(organization_id, purpose, sort_order)
  where deleted_at is null and organization_id is not null;
create index if not exists media_assets_application_purpose_idx
  on public.media_assets(application_id, purpose, sort_order)
  where deleted_at is null and application_id is not null;
create index if not exists media_assets_publication_purpose_idx
  on public.media_assets(publication_id, purpose, sort_order)
  where deleted_at is null and publication_id is not null;
create index if not exists media_assets_menu_item_purpose_idx
  on public.media_assets(menu_item_id, purpose, sort_order)
  where deleted_at is null and menu_item_id is not null;
create unique index if not exists media_assets_one_org_asset_idx
  on public.media_assets(organization_id, purpose)
  where deleted_at is null and purpose in ('organization_logo', 'organization_cover');
create unique index if not exists media_assets_one_application_confirmation_idx
  on public.media_assets(application_id, purpose)
  where deleted_at is null and purpose = 'application_confirmation';
create unique index if not exists media_assets_one_publication_photo_idx
  on public.media_assets(publication_id, purpose)
  where deleted_at is null and purpose = 'publication_photo';
create unique index if not exists media_assets_one_menu_item_photo_idx
  on public.media_assets(menu_item_id, purpose)
  where deleted_at is null and purpose = 'menu_item_photo';

drop trigger if exists set_publication_categories_updated_at on public.publication_categories;
create trigger set_publication_categories_updated_at
before update on public.publication_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_media_assets_updated_at on public.media_assets;
create trigger set_media_assets_updated_at
before update on public.media_assets
for each row execute function public.set_updated_at();

alter table public.organization_types enable row level security;
alter table public.publication_categories enable row level security;
alter table public.media_assets enable row level security;

grant select on public.organization_types to anon, authenticated;
grant select on public.publication_categories to anon, authenticated;
grant select, insert, update, delete on public.media_assets to authenticated;
grant select on public.media_assets to anon;

create policy "Public can read active organization types"
on public.organization_types
for select
to anon, authenticated
using (is_active = true or public.is_admin());

create policy "Public can read active publication categories"
on public.publication_categories
for select
to anon, authenticated
using (is_active = true or public.is_admin());

create policy "Public can read public media assets"
on public.media_assets
for select
to anon, authenticated
using (
  deleted_at is null
  and visibility = 'public'
  and (
    (
      organization_id is not null
      and exists (
        select 1 from public.organizations organization_record
        where organization_record.id = organization_id
          and organization_record.status = 'active'
      )
    )
    or (
      publication_id is not null
      and exists (
        select 1 from public.publications publication
        where publication.id = publication_id
          and public.is_public_publication(publication)
      )
    )
    or (
      menu_item_id is not null
      and exists (
        select 1
        from public.menu_items item
        join public.organizations organization_record on organization_record.id = item.organization_id
        where item.id = menu_item_id
          and item.is_available
          and organization_record.status = 'active'
      )
    )
  )
);

create policy "Applicants can read own application media"
on public.media_assets
for select
to authenticated
using (
  deleted_at is null
  and application_id is not null
  and exists (
    select 1 from public.organization_applications application
    where application.id = application_id
      and application.applicant_id = auth.uid()
  )
);

create policy "Members can manage organization media assets"
on public.media_assets
for all
to authenticated
using (
  public.is_admin()
  or (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  or (
    publication_id is not null
    and exists (
      select 1 from public.publications publication
      where publication.id = publication_id
        and public.is_org_member(publication.organization_id)
    )
  )
  or (
    menu_item_id is not null
    and exists (
      select 1 from public.menu_items item
      where item.id = menu_item_id
        and public.is_org_member(item.organization_id)
    )
  )
)
with check (
  public.is_admin()
  or (
    uploaded_by = auth.uid()
    and (
      (organization_id is not null and public.is_org_member(organization_id))
      or (
        application_id is not null
        and exists (
          select 1 from public.organization_applications application
          where application.id = application_id
            and application.applicant_id = auth.uid()
            and application.status in ('draft', 'needs_changes')
        )
      )
      or (
        publication_id is not null
        and exists (
          select 1 from public.publications publication
          where publication.id = publication_id
            and public.is_org_member(publication.organization_id)
        )
      )
      or (
        menu_item_id is not null
        and exists (
          select 1 from public.menu_items item
          where item.id = menu_item_id
            and public.is_org_member(item.organization_id)
        )
      )
    )
  )
);

create policy "Public can read media storage objects"
on storage.objects
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.media_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.storage_path = storage.objects.name
      and asset.deleted_at is null
      and asset.visibility = 'public'
      and (
        (
          asset.organization_id is not null
          and exists (
            select 1 from public.organizations organization_record
            where organization_record.id = asset.organization_id
              and organization_record.status = 'active'
          )
        )
        or (
          asset.publication_id is not null
          and exists (
            select 1 from public.publications publication
            where publication.id = asset.publication_id
              and public.is_public_publication(publication)
          )
        )
        or (
          asset.menu_item_id is not null
          and exists (
            select 1
            from public.menu_items item
            join public.organizations organization_record on organization_record.id = item.organization_id
            where item.id = asset.menu_item_id
              and item.is_available
              and organization_record.status = 'active'
          )
        )
      )
  )
);

create policy "Members can upload media storage objects"
on storage.objects
for insert
to authenticated
with check (
  (
    bucket_id = 'organization-images'
    and (
      public.is_admin()
      or public.is_org_member((storage.foldername(name))[2]::uuid)
    )
  )
  or (
    bucket_id = 'publication-images'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.publications publication
        where publication.id = (storage.foldername(name))[2]::uuid
          and public.is_org_member(publication.organization_id)
      )
    )
  )
  or (
    bucket_id = 'menu-images'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.menu_items item
        where item.id = (storage.foldername(name))[2]::uuid
          and public.is_org_member(item.organization_id)
      )
    )
  )
  or (
    bucket_id = 'application-confirmation-images'
    and exists (
      select 1
      from public.organization_applications application
      where application.id = (storage.foldername(name))[2]::uuid
        and application.applicant_id = auth.uid()
        and application.status in ('draft', 'needs_changes')
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-confirmation-images', 'application-confirmation-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
