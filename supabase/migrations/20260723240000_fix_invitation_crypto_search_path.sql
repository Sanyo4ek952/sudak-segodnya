-- pgcrypto is installed in the extensions schema in Supabase. Keep the
-- SECURITY DEFINER search path explicit so token creation and verification work
-- identically in local, staging and production environments.
alter function public.invite_organization_representative(
  uuid,
  text,
  public.organization_member_role
)
set search_path = public, auth, extensions, pg_temp;

alter function public.accept_organization_invitation(text)
set search_path = public, auth, extensions, pg_temp;
