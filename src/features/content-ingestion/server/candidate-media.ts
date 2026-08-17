import "server-only";
import { createSupabaseAdminClient } from "@/shared/api/supabase/admin";

const maximumImageBytes = 5 * 1024 * 1024;
const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export type CandidateMediaMaterializationResult = {
  selectedCount: number;
  importedCount: number;
  warnings: string[];
};

function mediaLabel(kind: "photo" | "video" | "clip", index: number) {
  if (kind === "photo") return `Фото ${index + 1}`;
  return `${kind === "clip" ? "Клип" : "Видео"} ${index + 1}`;
}

export async function materializeCandidateMedia({
  candidateId,
  publicationId,
  uploadedBy
}: {
  candidateId: string;
  publicationId: string;
  uploadedBy: string;
}): Promise<CandidateMediaMaterializationResult> {
  const admin = createSupabaseAdminClient();
  const { data: candidateMedia, error: loadError } = await admin
    .from("content_candidate_media")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("included", true)
    .eq("status", "ready")
    .order("sort_order")
    .limit(10);
  if (loadError) return { selectedCount: 0, importedCount: 0, warnings: ["Не удалось загрузить медиагалерею кандидата."] };
  if (!candidateMedia?.length) return { selectedCount: 0, importedCount: 0, warnings: [] };

  const { data: existing } = await admin
    .from("publication_media")
    .select("source_candidate_media_id")
    .eq("publication_id", publicationId)
    .not("source_candidate_media_id", "is", null);
  const materializedIds = new Set((existing ?? []).flatMap((item) => (
    item.source_candidate_media_id ? [item.source_candidate_media_id] : []
  )));

  let importedCount = 0;
  const warnings: string[] = [];
  for (let index = 0; index < candidateMedia.length; index += 1) {
    const media = candidateMedia[index];
    if (materializedIds.has(media.id)) {
      importedCount += 1;
      continue;
    }
    const label = mediaLabel(media.kind, index);
    if (!media.bucket_id || !media.storage_path) {
      warnings.push(`${label}: отсутствует подготовленный постер.`);
      continue;
    }

    const { data: downloaded, error: downloadError } = await admin.storage
      .from(media.bucket_id)
      .download(media.storage_path);
    const mimeType = downloaded?.type?.split(";", 1)[0].toLowerCase() ?? "";
    const extension = mimeExtensions[mimeType];
    if (downloadError || !downloaded || !extension || downloaded.size <= 0 || downloaded.size > maximumImageBytes) {
      warnings.push(`${label}: подготовленное изображение недоступно или имеет неверный формат.`);
      continue;
    }

    const storagePath = `publications/${publicationId}/${crypto.randomUUID()}.${extension}`;
    const bytes = new Uint8Array(await downloaded.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("publication-images")
      .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) {
      warnings.push(`${label}: не удалось скопировать изображение.`);
      continue;
    }

    const purpose = media.kind === "photo" ? "publication_photo" : "publication_video_poster";
    const { data: asset, error: assetError } = await admin
      .from("media_assets")
      .insert({
        bucket_id: "publication-images",
        storage_path: storagePath,
        purpose,
        visibility: "public",
        publication_id: publicationId,
        alt_text: media.title,
        width: media.width,
        height: media.height,
        mime_type: mimeType,
        size_bytes: downloaded.size,
        sort_order: index,
        uploaded_by: uploadedBy
      })
      .select("id")
      .single();
    if (assetError || !asset) {
      await admin.storage.from("publication-images").remove([storagePath]);
      warnings.push(`${label}: не удалось зарегистрировать изображение.`);
      continue;
    }

    const mediaPayload = {
      source_candidate_media_id: media.id,
      provider: media.kind === "photo" ? null : "vk",
      external_id: media.external_id,
      source_url: media.kind === "photo" ? null : media.source_url,
      embed_url: media.kind === "photo" ? null : media.embed_url,
      title: media.title,
      duration_seconds: media.duration_seconds,
      width: media.width,
      height: media.height
    };
    let linkError: { message: string } | null;
    if (media.kind === "photo") {
      const result = await admin.from("publication_media").update(mediaPayload).eq("media_asset_id", asset.id);
      linkError = result.error;
    } else {
      const { count } = await admin
        .from("publication_media")
        .select("id", { count: "exact", head: true })
        .eq("publication_id", publicationId);
      const result = await admin.from("publication_media").insert({
        publication_id: publicationId,
        media_asset_id: asset.id,
        kind: media.kind,
        sort_order: count ?? 0,
        ...mediaPayload
      });
      linkError = result.error;
    }
    if (linkError) {
      await admin.from("publication_media").delete().eq("media_asset_id", asset.id);
      await admin.from("media_assets").update({ deleted_at: new Date().toISOString() }).eq("id", asset.id);
      await admin.storage.from("publication-images").remove([storagePath]);
      warnings.push(`${label}: не удалось добавить элемент в публикацию.`);
      continue;
    }
    importedCount += 1;
  }

  return { selectedCount: candidateMedia.length, importedCount, warnings };
}
