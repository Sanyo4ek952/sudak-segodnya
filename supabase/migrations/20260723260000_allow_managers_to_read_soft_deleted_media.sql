drop policy if exists "Authenticated users can read manageable media assets" on public.media_assets;

create policy "Authenticated users can read manageable media assets"
on public.media_assets
for select
to authenticated
using (public.can_manage_media_asset(media_assets));
