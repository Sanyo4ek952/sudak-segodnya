import { NextResponse } from "next/server";
import type { PublicationMedia } from "@/entities/publication/model/types";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

export async function GET(request: Request) {
  const values = new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  const parsedIds = values.slice(0, 50).map((value) => postgresUuidSchema.safeParse(value));
  if (!parsedIds.length || parsedIds.some((result) => !result.success)) {
    return NextResponse.json({ mediaByPublication: {} }, { status: 400 });
  }
  const ids = parsedIds.flatMap((result) => result.success ? [result.data] : []);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("publication_media")
    .select(`
      id, publication_id, kind, provider, source_url, embed_url, title,
      duration_seconds, width, height, sort_order,
      media_assets!publication_media_media_asset_id_fkey(bucket_id, storage_path)
    `)
    .in("publication_id", ids)
    .order("sort_order")
    .limit(ids.length * 10);
  if (error) return NextResponse.json({ mediaByPublication: {} });

  const rows = data ?? [];
  const paths = rows.flatMap((row) => {
    const asset = Array.isArray(row.media_assets) ? row.media_assets[0] : row.media_assets;
    return asset ? [asset.storage_path] : [];
  });
  const signed = paths.length
    ? await supabase.storage.from("publication-images").createSignedUrls(paths, 60 * 10)
    : { data: [], error: null };
  const signedByPath = new Map((signed.data ?? []).flatMap((item) => (
    item.signedUrl ? [[item.path ?? "", item.signedUrl] as const] : []
  )));
  const mediaByPublication: Record<string, PublicationMedia[]> = Object.fromEntries(ids.map((id) => [id, []]));
  rows.forEach((row) => {
    const asset = Array.isArray(row.media_assets) ? row.media_assets[0] : row.media_assets;
    const posterUrl = asset ? signedByPath.get(asset.storage_path) : undefined;
    if (!posterUrl) return;
    const base = {
      id: row.id,
      posterUrl,
      title: row.title ?? undefined,
      width: row.width ?? undefined,
      height: row.height ?? undefined
    };
    if (row.kind === "photo") {
      mediaByPublication[row.publication_id]?.push({ ...base, kind: "photo" });
    } else if (
      (row.kind === "video" || row.kind === "clip")
      && row.provider === "vk"
      && row.source_url
      && row.embed_url
    ) {
      mediaByPublication[row.publication_id]?.push({
        ...base,
        kind: row.kind,
        provider: "vk",
        sourceUrl: row.source_url,
        embedUrl: row.embed_url,
        durationSeconds: row.duration_seconds ?? undefined
      });
    }
  });
  return NextResponse.json({ mediaByPublication }, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" }
  });
}
