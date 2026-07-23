drop policy if exists "Members and admins can read manageable media storage objects" on storage.objects;

create policy "Members and admins can read manageable media storage objects"
on storage.objects
for select
to authenticated
using (
  exists (
    select 1
    from public.media_assets asset
    where asset.bucket_id = storage.objects.bucket_id
      and asset.storage_path = storage.objects.name
      and public.can_manage_media_asset(asset)
  )
  or (
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
    )
  )
);
