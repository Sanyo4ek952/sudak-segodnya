create table if not exists public.organization_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_categories_slug_not_empty check (length(btrim(slug)) > 0),
  constraint organization_categories_name_not_empty check (length(btrim(name)) > 0)
);

insert into public.organization_categories (id, slug, name, sort_order)
values
  ('30000000-0000-0000-0000-000000000001', 'food', 'Еда', 10),
  ('30000000-0000-0000-0000-000000000002', 'delivery', 'Доставка', 20),
  ('30000000-0000-0000-0000-000000000003', 'kids', 'Детям', 30),
  ('30000000-0000-0000-0000-000000000004', 'culture', 'Культура', 40),
  ('30000000-0000-0000-0000-000000000005', 'excursions', 'Экскурсии', 50),
  ('30000000-0000-0000-0000-000000000006', 'rental', 'Прокат', 60),
  ('30000000-0000-0000-0000-000000000007', 'shops', 'Магазины', 70),
  ('30000000-0000-0000-0000-000000000008', 'services', 'Услуги', 80)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;

alter table public.organizations
  add column if not exists category_id uuid references public.organization_categories(id);

alter table public.organization_applications
  add column if not exists category_id uuid references public.organization_categories(id);

update public.organizations organization_record
set category_id = category.id
from public.organization_categories category
where organization_record.category_id is null
  and organization_record.status = 'active'
  and category.slug = 'services';

update public.organization_applications application
set category_id = category.id
from public.organization_categories category
where application.category_id is null
  and application.category_name is not null
  and lower(btrim(application.category_name)) in (category.slug, lower(category.name));

create index if not exists organization_categories_active_sort_idx
  on public.organization_categories(is_active, sort_order);

create index if not exists organizations_status_category_idx
  on public.organizations(status, category_id);

create index if not exists organization_applications_category_idx
  on public.organization_applications(category_id);

create unique index if not exists organization_applications_one_active_name_idx
  on public.organization_applications(applicant_id, lower(btrim(organization_name)))
  where status in ('draft', 'submitted', 'needs_changes')
    and organization_name is not null;

create trigger set_organization_categories_updated_at
before update on public.organization_categories
for each row execute function public.set_updated_at();

alter table public.organization_categories enable row level security;

grant select on public.organization_categories to anon, authenticated;

create policy "Public can read active organization categories"
on public.organization_categories
for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "Users can update own applications" on public.organization_applications;

create policy "Users can update own applications"
on public.organization_applications
for update
to authenticated
using (applicant_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    applicant_id = auth.uid()
    and status in ('draft', 'submitted', 'needs_changes')
    and organization_id is null
    and reviewed_by is null
    and reviewed_at is null
  )
);

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    'user',
    nullif(btrim(coalesce(new.raw_user_meta_data->>'display_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

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
    and category_id is not null
    and nullif(btrim(coalesce(description, '')), '') is not null
    and nullif(btrim(coalesce(address, '')), '') is not null
    and nullif(btrim(coalesce(phone, '')), '') is not null
    and nullif(btrim(coalesce(relationship, '')), '') is not null
  returning * into submitted_application;

  if submitted_application.id is null then
    raise exception 'Application cannot be submitted';
  end if;

  return submitted_application;
end;
$$;

grant execute on function public.submit_organization_application(uuid) to authenticated;
