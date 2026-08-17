import type { PublicationMedia } from "@/entities/publication/model/types";
import { PublicationMediaCarousel } from "@/entities/publication/ui/publication-media-carousel";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";

export async function PublicationMediaCarouselServer({
  publicationId,
  publicationTitle,
  publicationHref,
  fallbackImage,
  variant = "card",
  className
}: {
  publicationId: string;
  publicationTitle: string;
  publicationHref: string;
  fallbackImage?: string;
  variant?: "card" | "detail";
  className?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publication_media")
    .select(`
      id, kind, provider, source_url, embed_url, title,
      duration_seconds, width, height, sort_order,
      media_assets!publication_media_media_asset_id_fkey(bucket_id, storage_path)
    `)
    .eq("publication_id", publicationId)
    .order("sort_order")
    .limit(10);

  const rows = error ? [] : data ?? [];
  const assets = rows.flatMap((row) => {
    const asset = Array.isArray(row.media_assets) ? row.media_assets[0] : row.media_assets;
    return asset ? [{ id: row.id, asset }] : [];
  });
  const paths = assets.map(({ asset }) => asset.storage_path);
  const signed = paths.length
    ? await supabase.storage.from("publication-images").createSignedUrls(paths, 60 * 10)
    : { data: [], error: null };
  const signedByPath = new Map((signed.data ?? []).flatMap((item) => (
    item.signedUrl ? [[item.path ?? "", item.signedUrl] as const] : []
  )));
  const signedById = new Map(assets.flatMap(({ id, asset }) => {
    const signedUrl = signedByPath.get(asset.storage_path);
    return signedUrl ? [[id, signedUrl] as const] : [];
  }));

  const media: PublicationMedia[] = [];
  rows.forEach((row) => {
    const posterUrl = signedById.get(row.id);
    if (!posterUrl) return;
    const base = {
      id: row.id,
      posterUrl,
      title: row.title ?? undefined,
      width: row.width ?? undefined,
      height: row.height ?? undefined
    };
    if (row.kind === "photo") {
      media.push({ ...base, kind: "photo" });
      return;
    }
    if (
      (row.kind === "video" || row.kind === "clip")
      && row.provider === "vk"
      && row.source_url
      && row.embed_url
    ) media.push({
      ...base,
      kind: row.kind,
      provider: "vk" as const,
      sourceUrl: row.source_url,
      embedUrl: row.embed_url,
      durationSeconds: row.duration_seconds ?? undefined
    });
  });

  if (!media.length && fallbackImage) {
    media.push({ id: `legacy-${publicationId}`, kind: "photo", posterUrl: fallbackImage });
  }
  if (!media.length) return null;
  return (
    <PublicationMediaCarousel
      media={media}
      publicationTitle={publicationTitle}
      publicationHref={publicationHref}
      variant={variant}
      className={className}
    />
  );
}
