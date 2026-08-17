import { NextResponse } from "next/server";
import { z } from "zod";
import type { PublicationMedia } from "@/entities/publication/model/types";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicationId: string }> }
) {
  const params = await context.params;
  const parsedId = postgresUuidSchema.safeParse(params.publicationId);
  if (!parsedId.success) return NextResponse.json({ media: [] }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("publication_media")
    .select(`
      id, kind, provider, source_url, embed_url, title,
      duration_seconds, width, height, sort_order,
      media_assets!publication_media_media_asset_id_fkey(bucket_id, storage_path)
    `)
    .eq("publication_id", parsedId.data)
    .order("sort_order")
    .limit(10);
  if (error) return NextResponse.json({ media: [] }, { status: 200 });

  const rows = data ?? [];
  const paths = rows.flatMap((row) => {
    const asset = Array.isArray(row.media_assets) ? row.media_assets[0] : row.media_assets;
    return asset ? [asset.storage_path] : [];
  });
  const signed = paths.length
    ? await supabase.storage.from("publication-images").createSignedUrls(paths, 60 * 10)
    : { data: [], error: null };
  if (signed.error) return NextResponse.json({ media: [] }, { status: 200 });
  const signedByPath = new Map((signed.data ?? []).flatMap((item) => (
    item.signedUrl ? [[item.path ?? "", item.signedUrl] as const] : []
  )));

  const media: PublicationMedia[] = [];
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
  const body = z.object({ media: z.array(z.unknown()).max(10) }).parse({ media });
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" }
  });
}
