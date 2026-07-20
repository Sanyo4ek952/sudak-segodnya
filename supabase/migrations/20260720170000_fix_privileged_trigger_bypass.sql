create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_role not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if tg_op = 'INSERT' then
    if new.id <> auth.uid() then
      raise exception 'Cannot create a profile for another user';
    end if;

    if new.role <> 'user' then
      raise exception 'Cannot set profile role';
    end if;
  else
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

create or replace function public.protect_organization_application_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_role not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if tg_op = 'INSERT' then
    if new.applicant_id <> auth.uid() then
      raise exception 'Cannot create an application for another user';
    end if;

    if new.status <> 'draft' then
      raise exception 'Cannot set application status';
    end if;

    if new.organization_id is not null then
      raise exception 'Cannot bind organization directly';
    end if;

    if new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'Cannot set review fields';
    end if;

    if new.admin_comment is not null then
      raise exception 'Cannot set admin comment';
    end if;
  else
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
