"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseVkDirectVideoUrl } from "../../../../supabase/functions/_shared/vk-embed";
import { fetchVkMediaImage, validateVkMediaImage } from "../../../../supabase/functions/_shared/vk-media";
import { publicationMediaWritesEnabled, resolveVkMedia } from "@/features/vk-import/server/resolve-media";
import { createSupabaseAdminClient } from "@/shared/api/supabase/admin";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

export type CandidateMediaActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const idsSchema = z.object({
  candidateId: postgresUuidSchema,
  mediaId: postgresUuidSchema.optional()
});
const maximumImageBytes = 5 * 1024 * 1024;

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function error(message: string): CandidateMediaActionState {
  return { status: "error", message };
}

async function adminContext(candidateId: string) {
  if (!publicationMediaWritesEnabled()) throw new Error("Изменение галерей временно отключено.");
  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: isAdmin }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("is_admin")
  ]);
  if (!userData.user || !isAdmin) throw new Error("Administrator access required");
  const admin = createSupabaseAdminClient();
  const { data: candidate } = await admin
    .from("content_candidates")
    .select("id, status")
    .eq("id", candidateId)
    .in("status", ["pending", "duplicate"])
    .maybeSingle();
  if (!candidate) throw new Error("Candidate is no longer editable");
  return { admin, user: userData.user };
}

async function nextSortOrder(candidateId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("content_candidate_media")
    .select("sort_order")
    .eq("candidate_id", candidateId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

async function canInclude(candidateId: string) {
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("content_candidate_media")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", candidateId)
    .eq("included", true);
  return (count ?? 0) < 10;
}

function candidatePath(candidateId: string) {
  revalidatePath(`/admin/content/candidates/${candidateId}`);
  revalidatePath("/admin/content");
}

export async function uploadCandidatePhotoAction(
  _state: CandidateMediaActionState,
  formData: FormData
): Promise<CandidateMediaActionState> {
  const parsed = idsSchema.pick({ candidateId: true }).safeParse({
    candidateId: stringValue(formData, "candidateId")
  });
  const file = formData.get("image");
  if (!parsed.success || !(file instanceof File)) return error("Выберите изображение.");
  if (!file.size || file.size > maximumImageBytes) return error("Изображение должно быть не больше 5 МБ.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return error("Разрешены JPG, PNG и WebP.");
  }

  try {
    const { admin, user } = await adminContext(parsed.data.candidateId);
    const validated = await validateVkMediaImage(new Uint8Array(await file.arrayBuffer()), file.type);
    const storagePath = `candidates/${parsed.data.candidateId}/${crypto.randomUUID()}.${validated.extension}`;
    const { error: uploadError } = await admin.storage
      .from("content-candidate-media")
      .upload(storagePath, validated.bytes, { contentType: validated.mimeType, upsert: false });
    if (uploadError) return error("Не удалось загрузить изображение.");
    const { error: insertError } = await admin.from("content_candidate_media").insert({
      candidate_id: parsed.data.candidateId,
      kind: "photo",
      source_kind: "manual_upload",
      bucket_id: "content-candidate-media",
      storage_path: storagePath,
      included: await canInclude(parsed.data.candidateId),
      status: "ready",
      sort_order: await nextSortOrder(parsed.data.candidateId),
      created_by: user.id
    });
    if (insertError) {
      await admin.storage.from("content-candidate-media").remove([storagePath]);
      return error("Не удалось добавить изображение в галерею.");
    }
    candidatePath(parsed.data.candidateId);
    return { status: "success", message: "Фото добавлено." };
  } catch {
    return error("Не удалось добавить изображение.");
  }
}

async function storeResolvedCandidateVideo(candidateId: string, userId: string, sourceUrl: string) {
  const direct = parseVkDirectVideoUrl(sourceUrl);
  if (!direct) throw new Error("Добавьте прямую ссылку VK вида video… или clip…");
  const admin = createSupabaseAdminClient();
  const [result] = await resolveVkMedia([sourceUrl]);
  if (!result || result.status === "error") {
    await admin.from("content_candidate_media").insert({
      candidate_id: candidateId,
      kind: direct.kind,
      source_kind: "manual_vk",
      source_media_key: `manual:${crypto.randomUUID()}`,
      source_url: direct.sourceUrl,
      external_id: direct.externalId,
      included: false,
      status: "error",
      error_message: result?.status === "error" ? result.error : "VK-видео недоступно.",
      sort_order: await nextSortOrder(candidateId),
      created_by: userId
    });
    throw new Error("VK-видео добавлено со статусом ошибки. Его можно подготовить повторно.");
  }
  if (!result.media.thumbnailUrl) throw new Error("VK не вернул постер видео.");
  const poster = await fetchVkMediaImage({ sourceUrl: result.media.thumbnailUrl });
  const storagePath = `candidates/${candidateId}/${crypto.randomUUID()}.${poster.extension}`;
  const { error: uploadError } = await admin.storage
    .from("content-candidate-media")
    .upload(storagePath, poster.bytes, { contentType: poster.mimeType, upsert: false });
  if (uploadError) throw new Error("Не удалось сохранить постер видео.");
  const { error: insertError } = await admin.from("content_candidate_media").insert({
    candidate_id: candidateId,
    kind: result.media.kind,
    source_kind: "manual_vk",
    source_media_key: `manual:${crypto.randomUUID()}`,
    bucket_id: "content-candidate-media",
    storage_path: storagePath,
    source_url: result.media.sourceUrl,
    embed_url: result.media.embedUrl,
    external_id: result.media.externalId,
    title: result.media.title,
    duration_seconds: result.media.durationSeconds,
    width: result.media.width,
    height: result.media.height,
    included: await canInclude(candidateId),
    status: "ready",
    sort_order: await nextSortOrder(candidateId),
    created_by: userId
  });
  if (insertError) {
    await admin.storage.from("content-candidate-media").remove([storagePath]);
    throw new Error("Не удалось добавить видео в галерею.");
  }
}

export async function addCandidateVkMediaAction(
  _state: CandidateMediaActionState,
  formData: FormData
): Promise<CandidateMediaActionState> {
  const parsed = idsSchema.pick({ candidateId: true }).safeParse({ candidateId: stringValue(formData, "candidateId") });
  const sourceUrl = stringValue(formData, "sourceUrl").trim();
  if (!parsed.success || !sourceUrl) return error("Укажите прямую ссылку на VK-видео или клип.");
  try {
    const { user } = await adminContext(parsed.data.candidateId);
    await storeResolvedCandidateVideo(parsed.data.candidateId, user.id, sourceUrl);
    candidatePath(parsed.data.candidateId);
    return { status: "success", message: "VK-видео добавлено." };
  } catch (caught) {
    candidatePath(parsed.data.candidateId);
    return error(caught instanceof Error ? caught.message : "Не удалось добавить VK-видео.");
  }
}

async function orderedCandidateMedia(candidateId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error: loadError } = await admin
    .from("content_candidate_media")
    .select("id, sort_order")
    .eq("candidate_id", candidateId)
    .order("sort_order");
  if (loadError) throw new Error("Failed to load candidate media");
  return data ?? [];
}

async function writeCandidateOrder(candidateId: string, orderedIds: string[]) {
  const admin = createSupabaseAdminClient();
  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    const { error: temporaryError } = await admin.from("content_candidate_media")
      .update({ sort_order: 1000 + index }).eq("candidate_id", candidateId).eq("id", id);
    if (temporaryError) throw new Error("Failed to stage candidate media order");
  }
  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index];
    const { error: orderError } = await admin.from("content_candidate_media")
      .update({ sort_order: index }).eq("candidate_id", candidateId).eq("id", id);
    if (orderError) throw new Error("Failed to save candidate media order");
  }
}

export async function mutateCandidateMediaAction(formData: FormData): Promise<void> {
  const parsed = idsSchema.required({ mediaId: true }).safeParse({
    candidateId: stringValue(formData, "candidateId"),
    mediaId: stringValue(formData, "mediaId")
  });
  const intent = z.enum(["toggle", "up", "down", "cover", "delete", "retry"]).safeParse(stringValue(formData, "intent"));
  if (!parsed.success || !intent.success) return;
  const { admin, user } = await adminContext(parsed.data.candidateId);
  const { data: media } = await admin.from("content_candidate_media").select("*")
    .eq("candidate_id", parsed.data.candidateId).eq("id", parsed.data.mediaId).maybeSingle();
  if (!media) return;

  if (intent.data === "toggle") {
    if (!media.included && media.status !== "ready") return;
    if (!media.included && !await canInclude(parsed.data.candidateId)) return;
    await admin.from("content_candidate_media").update({ included: !media.included }).eq("id", media.id);
  } else if (intent.data === "delete") {
    if (media.source_kind === "vk_import") return;
    await admin.from("content_candidate_media").delete().eq("id", media.id);
    if (media.bucket_id && media.storage_path) await admin.storage.from(media.bucket_id).remove([media.storage_path]);
  } else if (intent.data === "retry") {
    if (media.kind !== "photo" && media.source_url) {
      const [resolved] = await resolveVkMedia([media.source_url]);
      if (resolved?.status === "ready" && resolved.media.thumbnailUrl) {
        const poster = await fetchVkMediaImage({ sourceUrl: resolved.media.thumbnailUrl });
        const storagePath = `candidates/${parsed.data.candidateId}/${crypto.randomUUID()}.${poster.extension}`;
        const uploaded = await admin.storage.from("content-candidate-media")
          .upload(storagePath, poster.bytes, { contentType: poster.mimeType, upsert: false });
        if (!uploaded.error) {
          await admin.from("content_candidate_media").update({
            bucket_id: "content-candidate-media",
            storage_path: storagePath,
            source_url: resolved.media.sourceUrl,
            embed_url: resolved.media.embedUrl,
            title: resolved.media.title,
            duration_seconds: resolved.media.durationSeconds,
            width: resolved.media.width,
            height: resolved.media.height,
            status: "ready",
            error_message: null,
            included: await canInclude(parsed.data.candidateId)
          }).eq("id", media.id);
          if (media.source_kind !== "vk_import" && media.bucket_id && media.storage_path) {
            await admin.storage.from(media.bucket_id).remove([media.storage_path]);
          }
        }
      } else {
        await admin.from("content_candidate_media").update({
          status: "error",
          included: false,
          error_message: resolved?.status === "error" ? resolved.error : "VK-видео недоступно."
        }).eq("id", media.id);
      }
    }
  } else {
    const ordered = await orderedCandidateMedia(parsed.data.candidateId);
    const index = ordered.findIndex((item) => item.id === media.id);
    if (index >= 0) {
      const target = intent.data === "cover" ? 0 : intent.data === "up" ? Math.max(0, index - 1) : Math.min(ordered.length - 1, index + 1);
      const ids = ordered.map((item) => item.id);
      ids.splice(index, 1);
      ids.splice(target, 0, media.id);
      await writeCandidateOrder(parsed.data.candidateId, ids);
      if (intent.data === "cover" && !media.included && media.status === "ready" && await canInclude(parsed.data.candidateId)) {
        await admin.from("content_candidate_media").update({ included: true }).eq("id", media.id);
      }
    }
  }
  void user;
  candidatePath(parsed.data.candidateId);
}
