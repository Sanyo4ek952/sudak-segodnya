begin;

do $$
declare
  target_user_id uuid;
begin
  select id
    into target_user_id
  from auth.users
  where lower(email) = lower('Sanyo4ek952@gmail.com')
  limit 1;

  if target_user_id is null then
    raise exception 'Auth user with email % was not found', 'Sanyo4ek952@gmail.com';
  end if;

  insert into public.profiles (id, role, display_name)
  values (target_user_id, 'admin', 'Sanyo4ek952')
  on conflict (id) do update
  set role = 'admin',
      display_name = coalesce(public.profiles.display_name, excluded.display_name),
      updated_at = now();
end;
$$;

commit;
