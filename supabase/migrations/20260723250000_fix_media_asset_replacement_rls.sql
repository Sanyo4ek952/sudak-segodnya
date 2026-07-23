drop policy if exists "Authenticated users can manage allowed media assets" on public.media_assets;
drop policy if exists "Authenticated users can insert allowed media assets" on public.media_assets;
drop policy if exists "Authenticated users can update allowed media assets" on public.media_assets;
drop policy if exists "Authenticated users can delete allowed media assets" on public.media_assets;

create policy "Authenticated users can insert allowed media assets"
on public.media_assets
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.can_manage_media_asset(media_assets)
);

create policy "Authenticated users can update allowed media assets"
on public.media_assets
for update
to authenticated
using (public.can_manage_media_asset(media_assets))
with check (public.can_manage_media_asset(media_assets));

create policy "Authenticated users can delete allowed media assets"
on public.media_assets
for delete
to authenticated
using (public.can_manage_media_asset(media_assets));

drop policy if exists "Members and admins can delete linked media storage objects" on storage.objects;

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
      and public.can_manage_media_asset(asset)
  )
);
