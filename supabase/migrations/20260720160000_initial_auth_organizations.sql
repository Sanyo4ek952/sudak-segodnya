create type public.profile_role as enum ('user', 'admin');
create type public.organization_status as enum (
  'draft',
  'pending',
  'active',
  'needs_changes',
  'rejected',
  'blocked'
);
create type public.organization_member_role as enum ('owner', 'manager');
create type public.organization_application_status as enum (
  'draft',
  'submitted',
  'needs_changes',
  'approved',
  'rejected'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.profile_role not null default 'user',
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  status public.organization_status not null default 'draft',
  address text,
  phone text,
  working_hours text,
  contact_links jsonb not null default '{}'::jsonb,
  logo_path text,
  cover_path text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_not_empty check (length(btrim(slug)) > 0),
  constraint organizations_name_not_empty check (length(btrim(name)) > 0),
  constraint organizations_contact_links_object check (jsonb_typeof(contact_links) = 'object')
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.organization_member_role not null default 'manager',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_unique_user unique (organization_id, user_id)
);

create table public.organization_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  applicant_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  status public.organization_application_status not null default 'draft',
  organization_name text,
  category_name text,
  description text,
  address text,
  phone text,
  relationship text,
  confirmation_info text,
  admin_comment text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index organizations_status_idx on public.organizations(status);
create index organizations_created_by_idx on public.organizations(created_by);
create index organization_members_user_active_idx on public.organization_members(user_id, is_active);
create index organization_members_org_active_idx on public.organization_members(organization_id, is_active);
create index organization_applications_applicant_status_idx
  on public.organization_applications(applicant_id, status);
create index organization_applications_status_submitted_idx
  on public.organization_applications(status, submitted_at);
create index organization_applications_organization_idx
  on public.organization_applications(organization_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role = 'owner'
      and is_active = true
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_role in ('anon', 'authenticated') and auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if tg_op = 'INSERT' then
    if new.id <> auth.uid() and not public.is_admin() then
      raise exception 'Cannot create a profile for another user';
    end if;

    if new.role <> 'user' and not public.is_admin() then
      raise exception 'Cannot set profile role';
    end if;
  elsif not public.is_admin() then
    if new.id <> old.id then
      raise exception 'Cannot change profile id';
    end if;

    if new.role <> old.role then
      raise exception 'Cannot change profile role';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_organization_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_role in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'Only administrators can change organizations directly';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.protect_organization_member_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_role in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.user_id = auth.uid() then
        raise exception 'Cannot add yourself to an organization';
      end if;

      raise exception 'Only administrators can create organization members';
    elsif tg_op = 'UPDATE' then
      if new.organization_id <> old.organization_id then
        raise exception 'Cannot move organization membership';
      end if;

      if new.user_id <> old.user_id then
        raise exception 'Cannot change organization member user';
      end if;

      if new.role <> old.role then
        raise exception 'Cannot change organization member role';
      end if;

      raise exception 'Only administrators can update organization members';
    else
      raise exception 'Only administrators can delete organization members';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.protect_organization_application_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_role in ('anon', 'authenticated') and auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if tg_op = 'INSERT' then
    if new.applicant_id <> auth.uid() and not public.is_admin() then
      raise exception 'Cannot create an application for another user';
    end if;

    if new.status <> 'draft' and not public.is_admin() then
      raise exception 'Cannot set application status';
    end if;

    if new.organization_id is not null and not public.is_admin() then
      raise exception 'Cannot bind organization directly';
    end if;

    if (new.reviewed_by is not null or new.reviewed_at is not null) and not public.is_admin() then
      raise exception 'Cannot set review fields';
    end if;

    if new.admin_comment is not null and not public.is_admin() then
      raise exception 'Cannot set admin comment';
    end if;
  elsif not public.is_admin() then
    if new.applicant_id <> old.applicant_id then
      raise exception 'Cannot change applicant';
    end if;

    if new.organization_id is distinct from old.organization_id then
      raise exception 'Cannot change organization';
    end if;

    if new.status <> old.status then
      raise exception 'Cannot change application status';
    end if;

    if new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Cannot change review fields';
    end if;

    if new.admin_comment is distinct from old.admin_comment then
      raise exception 'Cannot change admin comment';
    end if;
  end if;

  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger set_organization_members_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

create trigger set_organization_applications_updated_at
before update on public.organization_applications
for each row execute function public.set_updated_at();

create trigger protect_profiles_system_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_system_fields();

create trigger protect_organizations_system_fields
before insert or update or delete on public.organizations
for each row execute function public.protect_organization_system_fields();

create trigger protect_organization_members_system_fields
before insert or update or delete on public.organization_members
for each row execute function public.protect_organization_member_system_fields();

create trigger protect_organization_applications_system_fields
before insert or update on public.organization_applications
for each row execute function public.protect_organization_application_system_fields();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_applications enable row level security;

grant usage on schema public to authenticated;
grant usage on schema public to anon;
grant select on public.organizations to anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update on public.organization_applications to authenticated;

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() or public.is_admin());

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "Public can read active organizations"
on public.organizations
for select
to anon, authenticated
using (status = 'active');

create policy "Members can read their organizations"
on public.organizations
for select
to authenticated
using (public.is_admin() or public.is_org_member(id));

create policy "Admins can insert organizations"
on public.organizations
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update organizations"
on public.organizations
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete organizations"
on public.organizations
for delete
to authenticated
using (public.is_admin());

create policy "Users can read allowed memberships"
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_member(organization_id)
  or public.is_admin()
);

create policy "Admins can insert memberships"
on public.organization_members
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update memberships"
on public.organization_members
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete memberships"
on public.organization_members
for delete
to authenticated
using (public.is_admin());

create policy "Users can read own applications"
on public.organization_applications
for select
to authenticated
using (applicant_id = auth.uid() or public.is_admin());

create policy "Users can create own applications"
on public.organization_applications
for insert
to authenticated
with check (
  applicant_id = auth.uid()
  and status = 'draft'
  and organization_id is null
  and reviewed_by is null
  and reviewed_at is null
);

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
    and admin_comment is null
  )
);
