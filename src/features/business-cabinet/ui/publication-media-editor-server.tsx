import { PublicationMediaEditor } from "@/features/business-cabinet/ui/publication-media-editor";
import { createSupabaseAdminClient } from "@/shared/api/supabase/admin";

export async function PublicationMediaEditorServer({ publicationId }: { publicationId: string }) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("publication_media")
    .select("id, kind, title, media_assets(bucket_id, storage_path)")
    .eq("publication_id", publicationId)
    .order("sort_order")
    .order("id");
  const items = await Promise.all((data ?? []).map(async (media) => {
    const asset = Array.isArray(media.media_assets) ? media.media_assets[0] : media.media_assets;
    const signed = asset
      ? await admin.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 60 * 10)
      : null;
    return signed?.data?.signedUrl ? {
      id: media.id,
      kind: media.kind,
      posterUrl: signed.data.signedUrl,
      title: media.title ?? undefined
    } : null;
  }));
  return <PublicationMediaEditor publicationId={publicationId} items={items.filter((item) => item !== null)} />;
}
