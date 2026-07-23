-- Organization application audit trail and secure representative management.

create extension if not exists pgcrypto;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  reason text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_entity_type_not_empty check (length(btrim(entity_type)) > 0),
  constraint audit_events_action_not_empty check (length(btrim(action)) > 0)
);

create index if not exists audit_events_entity_created_idx
  on public.audit_events(entity_type, entity_id, created_at desc);
create index if not exists audit_events_organization_created_idx
  on public.audit_events(organization_id, created_at desc)
  where organization_id is not null;

alter table public.audit_events enable row level security;

create policy "Authorized users can read audit events"
on public.audit_events
for select
to authenticated
using (
  public.is_admin()
  or (
    organization_id is not null
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

create or replace function public.write_entity_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_json jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_json jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  target_id uuid := coalesce((new_json ->> 'id')::uuid, (old_json ->> 'id')::uuid);
  target_organization_id uuid;
  event_action text;
  event_reason text;
  old_status text := old_json ->> 'status';
  new_status text := new_json ->> 'status';
begin
  target_organization_id := case
    when tg_table_name = 'organizations' then target_id
    else coalesce(
      (new_json ->> 'organization_id')::uuid,
      (old_json ->> 'organization_id')::uuid
    )
  end;

  event_action := case
    when tg_op = 'INSERT' then tg_table_name || '.created'
    when tg_op = 'DELETE' then tg_table_name || '.deleted'
    when old_status is distinct from new_status then tg_table_name || '.status.' || coalesce(new_status, 'none')
    when tg_table_name = 'organization_members'
      and (old_json ->> 'role') is distinct from (new_json ->> 'role')
      then 'organization_members.role.' || coalesce(new_json ->> 'role', 'none')
    when tg_table_name = 'organization_members'
      and (old_json ->> 'is_active') is distinct from (new_json ->> 'is_active')
      then 'organization_members.access.' || coalesce(new_json ->> 'is_active', 'false')
    else tg_table_name || '.updated'
  end;

  event_reason := case
    when tg_table_name = 'organization_applications'
      then nullif(btrim(coalesce(new_json ->> 'admin_comment', old_json ->> 'admin_comment', '')), '')
    when tg_table_name = 'publications'
      then nullif(btrim(coalesce(new_json ->> 'moderation_comment', old_json ->> 'moderation_comment', '')), '')
    else null
  end;

  insert into public.audit_events (
    actor_id,
    entity_type,
    entity_id,
    organization_id,
    action,
    reason,
    old_data,
    new_data
  )
  values (
    auth.uid(),
    tg_table_name,
    target_id,
    target_organization_id,
    event_action,
    event_reason,
    old_json,
    new_json
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_organization_applications on public.organization_applications;
create trigger audit_organization_applications
after insert or update or delete on public.organization_applications
for each row execute function public.write_entity_audit_event();

drop trigger if exists audit_organizations on public.organizations;
create trigger audit_organizations
after insert or update or delete on public.organizations
for each row execute function public.write_entity_audit_event();

drop trigger if exists audit_organization_members on public.organization_members;
create trigger audit_organization_members
after insert or update or delete on public.organization_members
for each row execute function public.write_entity_audit_event();

drop trigger if exists audit_publications on public.publications;
create trigger audit_publications
after insert or update or delete on public.publications
for each row execute function public.write_entity_audit_event();

drop trigger if exists audit_important_announcements on public.important_announcements;
create trigger audit_important_announcements
after insert or update or delete on public.important_announcements
for each row execute function public.write_entity_audit_event();

create or replace function public.submit_organization_application(application_id uuid)
returns public.organization_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  submitted_application public.organization_applications;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  update public.organization_applications
  set status = 'submitted',
      submitted_at = now(),
      reviewed_at = null,
      reviewed_by = null,
      updated_at = now()
  where id = submit_organization_application.application_id
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
    raise exception using errcode = '22023', message = 'Application cannot be submitted';
  end if;

  return submitted_application;
end;
$$;

create or replace function public.approve_organization_application(application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  locked_application public.organization_applications;
  created_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only administrators can approve applications';
  end if;

  select *
    into locked_application
  from public.organization_applications application
  where application.id = approve_organization_application.application_id
  for update;

  if locked_application.id is null then
    raise exception using errcode = '22023', message = 'Application not found';
  end if;

  if locked_application.status = 'approved'
    and locked_application.organization_id is not null
  then
    insert into public.organization_members (organization_id, user_id, role, is_active)
    values (
      locked_application.organization_id,
      locked_application.applicant_id,
      'owner',
      true
    )
    on conflict (organization_id, user_id) do update
    set role = 'owner',
        is_active = true,
        updated_at = now();

    return jsonb_build_object(
      'application_id', locked_application.id,
      'organization_id', locked_application.organization_id,
      'status', 'approved',
      'idempotent', true
    );
  end if;

  if locked_application.status <> 'submitted'
    or locked_application.organization_id is not null
  then
    raise exception using errcode = '22023', message = 'Application cannot be approved from current status';
  end if;

  if nullif(btrim(coalesce(locked_application.organization_name, '')), '') is null
    or locked_application.type_id is null
    or nullif(btrim(coalesce(locked_application.description, '')), '') is null
    or nullif(btrim(coalesce(locked_application.phone, '')), '') is null
  then
    raise exception using errcode = '22023', message = 'Application has incomplete organization data';
  end if;

  insert into public.organizations (
    slug,
    name,
    description,
    status,
    address,
    phone,
    type_id,
    created_by,
    last_public_update_at
  )
  values (
    public.make_organization_slug(locked_application.organization_name, locked_application.id),
    btrim(locked_application.organization_name),
    btrim(locked_application.description),
    'active',
    nullif(btrim(coalesce(locked_application.address, '')), ''),
    btrim(locked_application.phone),
    locked_application.type_id,
    locked_application.applicant_id,
    now()
  )
  returning id into created_organization_id;

  insert into public.organization_members (organization_id, user_id, role, is_active)
  values (created_organization_id, locked_application.applicant_id, 'owner', true)
  on conflict (organization_id, user_id) do update
  set role = 'owner',
      is_active = true,
      updated_at = now();

  update public.organization_applications
  set organization_id = created_organization_id,
      status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      admin_comment = null,
      updated_at = now()
  where id = locked_application.id;

  return jsonb_build_object(
    'application_id', locked_application.id,
    'organization_id', created_organization_id,
    'status', 'approved',
    'idempotent', false
  );
end;
$$;

do $$
begin
  create type public.organization_invitation_status as enum (
    'pending',
    'accepted',
    'revoked',
    'expired'
  );
exception when duplicate_object then null;
end
$$;

create table if not exists public.organization_member_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.organization_member_role not null default 'manager',
  status public.organization_invitation_status not null default 'pending',
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_member_invitations_email_not_empty check (
    length(btrim(email)) >= 3
  ),
  constraint organization_member_invitations_token_hash_not_empty check (
    length(token_hash) = 64
  )
);

create unique index if not exists organization_member_invitations_pending_email_idx
  on public.organization_member_invitations(organization_id, lower(email))
  where status = 'pending';

create index if not exists organization_member_invitations_expires_idx
  on public.organization_member_invitations(expires_at)
  where status = 'pending';

alter table public.organization_member_invitations enable row level security;

create policy "Owners can read organization invitations"
on public.organization_member_invitations
for select
to authenticated
using (
  public.is_admin()
  or public.is_org_owner(organization_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create or replace function public.protect_last_organization_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.role = 'owner'
    and old.is_active
    and (
      tg_op = 'DELETE'
      or not new.is_active
      or new.role <> 'owner'
    )
    and (
      select count(*)
      from public.organization_members owner_record
      where owner_record.organization_id = old.organization_id
        and owner_record.role = 'owner'
        and owner_record.is_active
    ) <= 1
  then
    raise exception using errcode = '23514', message = 'The last active owner cannot be removed or demoted';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_last_organization_owner_trigger on public.organization_members;
create trigger protect_last_organization_owner_trigger
before update or delete on public.organization_members
for each row execute function public.protect_last_organization_owner();

create or replace function public.list_organization_representatives(p_organization_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  display_name text,
  email text,
  role public.organization_member_role,
  is_active boolean,
  added_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null
    or not public.is_org_member(p_organization_id)
  then
    raise exception using errcode = '42501', message = 'Organization membership required';
  end if;

  return query
  select
    member_record.id,
    member_record.user_id,
    profile.display_name,
    auth_user.email::text,
    member_record.role,
    member_record.is_active,
    member_record.created_at
  from public.organization_members member_record
  left join public.profiles profile on profile.id = member_record.user_id
  left join auth.users auth_user on auth_user.id = member_record.user_id
  where member_record.organization_id = p_organization_id
  order by
    case when member_record.role = 'owner' then 0 else 1 end,
    member_record.created_at,
    member_record.id;
end;
$$;

create or replace function public.invite_organization_representative(
  p_organization_id uuid,
  p_email text,
  p_role public.organization_member_role default 'manager'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  invitation_token text := encode(gen_random_bytes(32), 'hex');
  invitation_id uuid;
begin
  if actor_id is null
    or not public.is_org_owner(p_organization_id)
  then
    raise exception using errcode = '42501', message = 'Organization owner access required';
  end if;

  if normalized_email !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' then
    raise exception using errcode = '22023', message = 'Valid email is required';
  end if;

  if not exists (
    select 1
    from public.organizations organization_record
    where organization_record.id = p_organization_id
      and organization_record.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'Organization must be active';
  end if;

  if exists (
    select 1
    from public.organization_members member_record
    join auth.users auth_user on auth_user.id = member_record.user_id
    where member_record.organization_id = p_organization_id
      and lower(auth_user.email) = normalized_email
      and member_record.is_active
  ) then
    raise exception using errcode = '23505', message = 'User is already an active representative';
  end if;

  update public.organization_member_invitations invitation
  set status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where invitation.organization_id = p_organization_id
    and lower(invitation.email) = normalized_email
    and invitation.status = 'pending';

  insert into public.organization_member_invitations (
    organization_id,
    email,
    role,
    token_hash,
    invited_by
  )
  values (
    p_organization_id,
    normalized_email,
    p_role,
    encode(digest(invitation_token, 'sha256'), 'hex'),
    actor_id
  )
  returning id into invitation_id;

  return jsonb_build_object(
    'invitation_id', invitation_id,
    'token', invitation_token,
    'expires_at', now() + interval '7 days'
  );
end;
$$;

create or replace function public.accept_organization_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  invitation_record public.organization_member_invitations;
  member_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  select lower(email)
    into actor_email
  from auth.users
  where id = actor_id;

  select invitation.*
    into invitation_record
  from public.organization_member_invitations invitation
  where invitation.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;

  if invitation_record.id is null
    or invitation_record.status <> 'pending'
    or invitation_record.expires_at <= now()
  then
    raise exception using errcode = '22023', message = 'Invitation is invalid or expired';
  end if;

  if lower(invitation_record.email) <> actor_email then
    raise exception using errcode = '42501', message = 'Invitation email does not match the signed-in user';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    is_active
  )
  values (
    invitation_record.organization_id,
    actor_id,
    invitation_record.role,
    true
  )
  on conflict (organization_id, user_id) do update
  set role = excluded.role,
      is_active = true,
      updated_at = now()
  returning id into member_id;

  update public.organization_member_invitations
  set status = 'accepted',
      accepted_by = actor_id,
      accepted_at = now(),
      updated_at = now()
  where id = invitation_record.id;

  return jsonb_build_object(
    'organization_id', invitation_record.organization_id,
    'member_id', member_id,
    'status', 'accepted'
  );
end;
$$;

create or replace function public.revoke_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_organization_id uuid;
begin
  select organization_id
    into target_organization_id
  from public.organization_member_invitations
  where id = p_invitation_id
    and status = 'pending'
  for update;

  if target_organization_id is null
    or not public.is_org_owner(target_organization_id)
  then
    raise exception using errcode = '42501', message = 'Organization owner access required';
  end if;

  update public.organization_member_invitations
  set status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where id = p_invitation_id;
end;
$$;

create or replace function public.manage_organization_representative(
  p_organization_id uuid,
  p_member_id uuid,
  p_action text,
  p_role public.organization_member_role default null
)
returns public.organization_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_member public.organization_members;
  saved_member public.organization_members;
begin
  if auth.uid() is null
    or not public.is_org_owner(p_organization_id)
  then
    raise exception using errcode = '42501', message = 'Organization owner access required';
  end if;

  select member_record.*
    into target_member
  from public.organization_members member_record
  where member_record.id = p_member_id
    and member_record.organization_id = p_organization_id
  for update;

  if target_member.id is null then
    raise exception using errcode = '22023', message = 'Representative not found';
  end if;

  if p_action = 'deactivate' then
    update public.organization_members
    set is_active = false,
        updated_at = now()
    where id = target_member.id
    returning * into saved_member;
  elsif p_action = 'activate' then
    update public.organization_members
    set is_active = true,
        updated_at = now()
    where id = target_member.id
    returning * into saved_member;
  elsif p_action = 'change_role' and p_role is not null then
    update public.organization_members
    set role = p_role,
        updated_at = now()
    where id = target_member.id
    returning * into saved_member;
  else
    raise exception using errcode = '22023', message = 'Unsupported representative action';
  end if;

  return saved_member;
end;
$$;

create or replace function public.transfer_organization_ownership(
  p_organization_id uuid,
  p_target_member_id uuid,
  p_keep_current_owner boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_member_id uuid;
  target_member public.organization_members;
begin
  if actor_id is null
    or not public.is_org_owner(p_organization_id)
  then
    raise exception using errcode = '42501', message = 'Organization owner access required';
  end if;

  select member_record.id
    into actor_member_id
  from public.organization_members member_record
  where member_record.organization_id = p_organization_id
    and member_record.user_id = actor_id
    and member_record.role = 'owner'
    and member_record.is_active
  for update;

  select member_record.*
    into target_member
  from public.organization_members member_record
  where member_record.id = p_target_member_id
    and member_record.organization_id = p_organization_id
    and member_record.is_active
  for update;

  if actor_member_id is null or target_member.id is null then
    raise exception using errcode = '22023', message = 'Active target representative not found';
  end if;

  if target_member.user_id = actor_id and not p_keep_current_owner then
    raise exception using errcode = '22023', message = 'Ownership cannot be transferred to the same user';
  end if;

  update public.organization_members
  set role = 'owner',
      updated_at = now()
  where id = target_member.id;

  if not p_keep_current_owner then
    update public.organization_members
    set role = 'manager',
        updated_at = now()
    where id = actor_member_id;
  end if;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'new_owner_member_id', target_member.id,
    'previous_owner_member_id', actor_member_id,
    'previous_owner_kept', p_keep_current_owner
  );
end;
$$;

revoke all on function public.list_organization_representatives(uuid) from public, anon;
revoke all on function public.invite_organization_representative(uuid, text, public.organization_member_role) from public, anon;
revoke all on function public.accept_organization_invitation(text) from public, anon;
revoke all on function public.revoke_organization_invitation(uuid) from public, anon;
revoke all on function public.manage_organization_representative(uuid, uuid, text, public.organization_member_role) from public, anon;
revoke all on function public.transfer_organization_ownership(uuid, uuid, boolean) from public, anon;

grant execute on function public.list_organization_representatives(uuid) to authenticated;
grant execute on function public.invite_organization_representative(uuid, text, public.organization_member_role) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;
grant execute on function public.manage_organization_representative(uuid, uuid, text, public.organization_member_role) to authenticated;
grant execute on function public.transfer_organization_ownership(uuid, uuid, boolean) to authenticated;
