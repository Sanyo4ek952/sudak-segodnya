do $$
begin
  create type public.publication_type as enum ('event', 'announcement', 'promo', 'regular', 'news');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.publication_status as enum (
    'draft',
    'scheduled',
    'moderation',
    'published',
    'cancelled',
    'completed',
    'hidden',
    'blocked'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.inaccuracy_report_status as enum ('new', 'reviewing', 'resolved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.important_announcement_status as enum ('draft', 'active', 'expired', 'hidden');
exception when duplicate_object then null;
end $$;

alter table public.organizations
  add column if not exists last_public_update_at timestamptz;

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  author_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  slug text not null unique,
  type public.publication_type not null,
  status public.publication_status not null default 'draft',
  title text not null,
  description text,
  category_slug text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  valid_until timestamptz,
  published_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  place text,
  price_text text,
  is_free boolean not null default false,
  age_limit text,
  image_path text,
  contact_phone text,
  sort_published_at timestamptz,
  moderation_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publications_slug_not_empty check (length(btrim(slug)) > 0),
  constraint publications_title_not_empty check (length(btrim(title)) > 0),
  constraint publications_category_slug_not_empty check (length(btrim(category_slug)) > 0),
  constraint publications_contact_phone_not_empty check (contact_phone is null or length(btrim(contact_phone)) > 0),
  constraint publications_event_time_order check (starts_at is null or ends_at is null or ends_at >= starts_at),
  constraint publications_published_has_content check (
    status not in ('published', 'cancelled')
    or (
      nullif(btrim(coalesce(description, '')), '') is not null
      and nullif(btrim(coalesce(price_text, '')), '') is not null
    )
  )
);

create table if not exists public.publication_schedules (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  schedule_text text not null,
  weekday smallint,
  starts_at time,
  ends_at time,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_schedules_text_not_empty check (length(btrim(schedule_text)) > 0),
  constraint publication_schedules_weekday_range check (weekday is null or weekday between 1 and 7),
  constraint publication_schedules_time_order check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_categories_name_not_empty check (length(btrim(name)) > 0)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  title text not null,
  description text,
  price_text text,
  image_path text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_title_not_empty check (length(btrim(title)) > 0)
);

create table if not exists public.important_announcements (
  id uuid primary key default gen_random_uuid(),
  status public.important_announcement_status not null default 'draft',
  title text not null,
  description text not null,
  publication_id uuid references public.publications(id) on delete set null,
  active_from timestamptz,
  active_until timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint important_announcements_title_not_empty check (length(btrim(title)) > 0),
  constraint important_announcements_description_not_empty check (length(btrim(description)) > 0),
  constraint important_announcements_active_period check (
    status <> 'active'
    or (active_from is not null and active_until is not null and active_until >= active_from)
  )
);

create table if not exists public.inaccuracy_reports (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_fingerprint text,
  reason text not null,
  comment text,
  status public.inaccuracy_report_status not null default 'new',
  admin_comment text,
  resolved_by uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inaccuracy_reports_reason_not_empty check (length(btrim(reason)) > 0),
  constraint inaccuracy_reports_guest_or_user check (
    reporter_user_id is not null or nullif(btrim(coalesce(reporter_fingerprint, '')), '') is not null
  )
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  publication_id uuid references public.publications(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_name_allowed check (
    event_name in (
      'organization_view',
      'publication_view',
      'phone_click',
      'route_click',
      'menu_open',
      'favorite_add'
    )
  ),
  constraint analytics_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists menu_categories_org_id_id_idx on public.menu_categories(organization_id, id);
create index if not exists publications_status_sort_idx on public.publications(status, sort_published_at desc);
create index if not exists publications_organization_status_idx on public.publications(organization_id, status);
create index if not exists publications_type_status_idx on public.publications(type, status);
create index if not exists publications_starts_at_idx on public.publications(starts_at);
create index if not exists publications_valid_until_idx on public.publications(valid_until);
create index if not exists publications_author_idx on public.publications(author_id);
create index if not exists publication_schedules_publication_sort_idx on public.publication_schedules(publication_id, sort_order);
create index if not exists menu_categories_org_active_sort_idx on public.menu_categories(organization_id, is_active, sort_order);
create index if not exists menu_items_org_available_sort_idx on public.menu_items(organization_id, is_available, sort_order);
create index if not exists menu_items_category_idx on public.menu_items(category_id);
create index if not exists important_announcements_status_period_idx
  on public.important_announcements(status, active_from, active_until);
create index if not exists important_announcements_publication_idx on public.important_announcements(publication_id);
create index if not exists inaccuracy_reports_publication_status_idx on public.inaccuracy_reports(publication_id, status);
create index if not exists inaccuracy_reports_status_created_idx on public.inaccuracy_reports(status, created_at);
create unique index if not exists inaccuracy_reports_user_unique_idx
  on public.inaccuracy_reports(publication_id, reporter_user_id, reason)
  where reporter_user_id is not null;
create index if not exists inaccuracy_reports_guest_idx
  on public.inaccuracy_reports(publication_id, reporter_fingerprint, reason)
  where reporter_fingerprint is not null;
create index if not exists analytics_events_organization_created_idx on public.analytics_events(organization_id, created_at);
create index if not exists analytics_events_publication_created_idx on public.analytics_events(publication_id, created_at);
create index if not exists analytics_events_name_created_idx on public.analytics_events(event_name, created_at);
create index if not exists analytics_events_created_idx on public.analytics_events(created_at);

create or replace function public.is_public_publication(publication_row public.publications)
returns boolean
language sql
stable
set search_path = public
as $$
  select publication_row.status in ('published', 'cancelled')
    and exists (
      select 1
      from public.organizations organization_record
      where organization_record.id = publication_row.organization_id
        and organization_record.status = 'active'
    )
    and (
      (
        publication_row.type = 'event'
        and coalesce(publication_row.ends_at, publication_row.starts_at) >= now()
      )
      or (
        publication_row.type in ('announcement', 'promo', 'regular')
        and publication_row.valid_until >= now()
      )
      or publication_row.type = 'news'
    );
$$;

create or replace function public.protect_publication_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_role in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.author_id <> auth.uid() then
        raise exception 'Cannot create a publication for another author';
      end if;

      if new.status in ('published', 'hidden', 'blocked') then
        raise exception 'Cannot set protected publication status directly';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.author_id <> old.author_id then
        raise exception 'Cannot change publication author';
      end if;

      if new.status in ('published', 'hidden', 'blocked') or old.status in ('hidden', 'blocked') then
        raise exception 'Only administrators can change protected publication status directly';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_inaccuracy_report_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_role in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.status <> 'new' then
        raise exception 'Cannot set report status';
      end if;

      if new.admin_comment is not null or new.resolved_by is not null or new.resolved_at is not null then
        raise exception 'Cannot set report review fields';
      end if;

      if auth.uid() is not null then
        new.reporter_user_id = auth.uid();
      end if;
    elsif tg_op = 'UPDATE' then
      raise exception 'Only administrators can update inaccuracy reports';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.check_menu_item_category_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1
    from public.menu_categories category
    where category.id = new.category_id
      and category.organization_id = new.organization_id
  ) then
    raise exception 'Menu item category must belong to the same organization';
  end if;

  return new;
end;
$$;

create trigger set_publications_updated_at
before update on public.publications
for each row execute function public.set_updated_at();

create trigger set_publication_schedules_updated_at
before update on public.publication_schedules
for each row execute function public.set_updated_at();

create trigger set_menu_categories_updated_at
before update on public.menu_categories
for each row execute function public.set_updated_at();

create trigger set_menu_items_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

create trigger set_important_announcements_updated_at
before update on public.important_announcements
for each row execute function public.set_updated_at();

create trigger set_inaccuracy_reports_updated_at
before update on public.inaccuracy_reports
for each row execute function public.set_updated_at();

create trigger protect_publications_system_fields
before insert or update on public.publications
for each row execute function public.protect_publication_system_fields();

create trigger protect_inaccuracy_reports_system_fields
before insert or update on public.inaccuracy_reports
for each row execute function public.protect_inaccuracy_report_system_fields();

create trigger check_menu_items_category_organization
before insert or update on public.menu_items
for each row execute function public.check_menu_item_category_organization();

alter table public.publications enable row level security;
alter table public.publication_schedules enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.important_announcements enable row level security;
alter table public.inaccuracy_reports enable row level security;
alter table public.analytics_events enable row level security;

grant select on public.publications to anon, authenticated;
grant select on public.publication_schedules to anon, authenticated;
grant select on public.menu_categories to anon, authenticated;
grant select on public.menu_items to anon, authenticated;
grant select on public.important_announcements to anon, authenticated;
grant insert on public.inaccuracy_reports to anon, authenticated;
grant select, insert, update, delete on public.publications to authenticated;
grant select, insert, update, delete on public.publication_schedules to authenticated;
grant select, insert, update, delete on public.menu_categories to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select, insert, update, delete on public.important_announcements to authenticated;
grant select, update on public.inaccuracy_reports to authenticated;
grant select, insert on public.analytics_events to anon, authenticated;

create policy "Public can read active publications"
on public.publications
for select
to anon, authenticated
using (public.is_public_publication(publications));

create policy "Members can read organization publications"
on public.publications
for select
to authenticated
using (public.is_admin() or public.is_org_member(organization_id));

create policy "Members can insert organization publications"
on public.publications
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and author_id = auth.uid()
  and status not in ('published', 'hidden', 'blocked')
);

create policy "Members can update organization publications"
on public.publications
for update
to authenticated
using (public.is_org_member(organization_id) or public.is_admin())
with check (
  public.is_admin()
  or (
    public.is_org_member(organization_id)
    and author_id = auth.uid()
    and status not in ('published', 'hidden', 'blocked')
  )
);

create policy "Members can delete draft publications"
on public.publications
for delete
to authenticated
using (
  public.is_admin()
  or (
    public.is_org_member(organization_id)
    and author_id = auth.uid()
    and status = 'draft'
  )
);

create policy "Public can read public publication schedules"
on public.publication_schedules
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.publications publication
    where publication.id = publication_id
      and public.is_public_publication(publication)
  )
);

create policy "Members can manage publication schedules"
on public.publication_schedules
for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.publications publication
    where publication.id = publication_id
      and public.is_org_member(publication.organization_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.publications publication
    where publication.id = publication_id
      and public.is_org_member(publication.organization_id)
  )
);

create policy "Public can read active menu categories"
on public.menu_categories
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.organizations organization_record
    where organization_record.id = organization_id
      and organization_record.status = 'active'
  )
);

create policy "Members can manage menu categories"
on public.menu_categories
for all
to authenticated
using (public.is_admin() or public.is_org_member(organization_id))
with check (public.is_admin() or public.is_org_member(organization_id));

create policy "Public can read available menu items"
on public.menu_items
for select
to anon, authenticated
using (
  is_available
  and exists (
    select 1
    from public.organizations organization_record
    where organization_record.id = organization_id
      and organization_record.status = 'active'
  )
  and (
    category_id is null
    or exists (
      select 1
      from public.menu_categories category
      where category.id = category_id
        and category.organization_id = organization_id
        and category.is_active
    )
  )
);

create policy "Members can manage menu items"
on public.menu_items
for all
to authenticated
using (public.is_admin() or public.is_org_member(organization_id))
with check (public.is_admin() or public.is_org_member(organization_id));

create policy "Public can read active important announcements"
on public.important_announcements
for select
to anon, authenticated
using (
  status = 'active'
  and now() between active_from and active_until
);

create policy "Admins can manage important announcements"
on public.important_announcements
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Public can create inaccuracy reports"
on public.inaccuracy_reports
for insert
to anon, authenticated
with check (
  status = 'new'
  and admin_comment is null
  and resolved_by is null
  and resolved_at is null
  and exists (
    select 1
    from public.publications publication
    where publication.id = publication_id
      and public.is_public_publication(publication)
  )
  and (
    (auth.uid() is not null and reporter_user_id = auth.uid())
    or (auth.uid() is null and reporter_user_id is null and reporter_fingerprint is not null)
  )
);

create policy "Admins can read and manage inaccuracy reports"
on public.inaccuracy_reports
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Members can read organization analytics"
on public.analytics_events
for select
to authenticated
using (
  public.is_admin()
  or (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
);

create policy "Public can insert analytics events"
on public.analytics_events
for insert
to anon, authenticated
with check (
  user_id is null
  and (
    organization_id is null
    or exists (
      select 1
      from public.organizations organization_record
      where organization_record.id = organization_id
        and organization_record.status = 'active'
    )
  )
  and (
    publication_id is null
    or exists (
      select 1
      from public.publications publication
      where publication.id = publication_id
        and public.is_public_publication(publication)
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('organization-images', 'organization-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('publication-images', 'publication-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('menu-images', 'menu-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read approved organization images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'organization-images'
  and exists (
    select 1
    from public.organizations organization_record
    where organization_record.status = 'active'
      and (organization_record.logo_path = name or organization_record.cover_path = name)
  )
);

create policy "Public can read approved publication images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'publication-images'
  and exists (
    select 1
    from public.publications publication
    where publication.image_path = name
      and public.is_public_publication(publication)
  )
);

create policy "Public can read approved menu images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'menu-images'
  and exists (
    select 1
    from public.menu_items item
    join public.organizations organization_record on organization_record.id = item.organization_id
    where item.image_path = name
      and item.is_available
      and organization_record.status = 'active'
  )
);

create policy "Members can upload organization images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organization-images'
  and (
    public.is_admin()
    or public.is_org_member((storage.foldername(name))[2]::uuid)
  )
);

create policy "Members can upload publication images"
on storage.objects
for insert
to authenticated
with check (
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
);

create policy "Members can upload menu images"
on storage.objects
for insert
to authenticated
with check (
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
);
