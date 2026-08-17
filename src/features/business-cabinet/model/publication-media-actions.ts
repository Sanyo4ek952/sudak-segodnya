"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchVkMediaImage, validateVkMediaImage } from "../../../../supabase/functions/_shared/vk-media";
import { resolveVkMedia, publicationMediaWritesEnabled } from "@/features/vk-import/server/resolve-media";
import { createSupabaseAdminClient } from "@/shared/api/supabase/admin";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

export type BusinessMediaActionState = { status: "idle" | "success" | "error"; message?: string };
const maximumImageBytes = 5 * 1024 * 1024;

function value(formData: FormData, key: string) {
  const current = formData.get(key);
  return typeof current === "string" ? current : "";
}

function fail(message: string): BusinessMediaActionState {
  return { status: "error", message };
}

async function publicationContext(publicationId: string) {
  if (!publicationMediaWritesEnabled()) throw new Error("Изменение галерей временно отключено.");
  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: isAdmin }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("is_admin")
  ]);
  if (!userData.user) throw new Error("Authentication required");
  const admin = createSupabaseAdminClient();
  const { data: publication } = await admin.from("publications")
    .select("id, slug, organization_id")
    .eq("id", publicationId)
    .maybeSingle();
  if (!publication) throw new Error("Сначала сохраните черновик публикации.");
  if (!isAdmin) {
    const { data: membership } = await admin.from("organization_members")
      .select("organization_id")
      .eq("organization_id", publication.organization_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!membership) throw new Error("Publication media access denied");
  }
  return { admin, user: userData.user, publication };
}

async function publicationMediaCount(publicationId: string) {
  const admin = createSupabaseAdminClient();
  const { count } = await admin.from("publication_media")
    .select("id", { count: "exact", head: true }).eq("publication_id", publicationId);
  return count ?? 0;
}

function refresh(publicationId: string, slug?: string) {
  revalidatePath("/business/publications");
  revalidatePath(`/business/publications/${publicationId}`);
  revalidatePath("/");
  if (slug) revalidatePath(`/p/${slug}`);
}

export async function addBusinessPublicationPhotoAction(
  _state: BusinessMediaActionState,
  formData: FormData
): Promise<BusinessMediaActionState> {
  const publicationId = postgresUuidSchema.safeParse(value(formData, "publicationId"));
  const file = formData.get("image");
  if (!publicationId.success || !(file instanceof File)) return fail("Выберите изображение.");
  if (!file.size || file.size > maximumImageBytes) return fail("Изображение должно быть не больше 5 МБ.");
  try {
    const { admin, user, publication } = await publicationContext(publicationId.data);
    if (await publicationMediaCount(publication.id) >= 10) return fail("В галерее уже 10 элементов.");
    const image = await validateVkMediaImage(new Uint8Array(await file.arrayBuffer()), file.type);
    const storagePath = `publications/${publication.id}/${crypto.randomUUID()}.${image.extension}`;
    const uploaded = await admin.storage.from("publication-images")
      .upload(storagePath, image.bytes, { contentType: image.mimeType, upsert: false });
    if (uploaded.error) return fail("Не удалось загрузить изображение.");
    const { error: assetError } = await admin.from("media_assets").insert({
      bucket_id: "publication-images",
      storage_path: storagePath,
      purpose: "publication_photo",
      visibility: "public",
      publication_id: publication.id,
      mime_type: image.mimeType,
      size_bytes: image.sizeBytes,
      sort_order: await publicationMediaCount(publication.id),
      uploaded_by: user.id
    });
    if (assetError) {
      await admin.storage.from("publication-images").remove([storagePath]);
      return fail("Не удалось добавить изображение в галерею.");
    }
    refresh(publication.id, publication.slug);
    return { status: "success", message: "Фото добавлено." };
  } catch (caught) {
    return fail(caught instanceof Error ? caught.message : "Не удалось добавить фото.");
  }
}

export async function addBusinessPublicationVkAction(
  _state: BusinessMediaActionState,
  formData: FormData
): Promise<BusinessMediaActionState> {
  const publicationId = postgresUuidSchema.safeParse(value(formData, "publicationId"));
  const sourceUrl = value(formData, "sourceUrl").trim();
  if (!publicationId.success || !sourceUrl) return fail("Укажите прямую ссылку на VK-видео или клип.");
  try {
    const { admin, user, publication } = await publicationContext(publicationId.data);
    const sortOrder = await publicationMediaCount(publication.id);
    if (sortOrder >= 10) return fail("В галерее уже 10 элементов.");
    const [resolved] = await resolveVkMedia([sourceUrl]);
    if (!resolved || resolved.status === "error") {
      return fail(resolved?.status === "error" ? resolved.error : "VK-видео недоступно.");
    }
    if (!resolved.media.thumbnailUrl) return fail("VK не вернул постер видео.");
    const poster = await fetchVkMediaImage({ sourceUrl: resolved.media.thumbnailUrl });
    const storagePath = `publications/${publication.id}/${crypto.randomUUID()}.${poster.extension}`;
    const upload = await admin.storage.from("publication-images")
      .upload(storagePath, poster.bytes, { contentType: poster.mimeType, upsert: false });
    if (upload.error) return fail("Не удалось сохранить постер видео.");
    const { data: asset, error: assetError } = await admin.from("media_assets").insert({
      bucket_id: "publication-images",
      storage_path: storagePath,
      purpose: "publication_video_poster",
      visibility: "public",
      publication_id: publication.id,
      alt_text: resolved.media.title,
      width: resolved.media.width,
      height: resolved.media.height,
      mime_type: poster.mimeType,
      size_bytes: poster.sizeBytes,
      sort_order: sortOrder,
      uploaded_by: user.id
    }).select("id").single();
    if (assetError || !asset) {
      await admin.storage.from("publication-images").remove([storagePath]);
      return fail("Не удалось зарегистрировать постер видео.");
    }
    const { error: mediaError } = await admin.from("publication_media").insert({
      publication_id: publication.id,
      media_asset_id: asset.id,
      kind: resolved.media.kind,
      provider: "vk",
      external_id: resolved.media.externalId,
      source_url: resolved.media.sourceUrl,
      embed_url: resolved.media.embedUrl,
      title: resolved.media.title,
      duration_seconds: resolved.media.durationSeconds,
      width: resolved.media.width,
      height: resolved.media.height,
      sort_order: sortOrder
    });
    if (mediaError) {
      await admin.from("media_assets").update({ deleted_at: new Date().toISOString() }).eq("id", asset.id);
      await admin.storage.from("publication-images").remove([storagePath]);
      return fail("Не удалось добавить видео в галерею.");
    }
    refresh(publication.id, publication.slug);
    return { status: "success", message: "VK-видео добавлено." };
  } catch (caught) {
    return fail(caught instanceof Error ? caught.message : "Не удалось добавить VK-видео.");
  }
}

async function normalizeOrder(publicationId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("publication_media").select("id")
    .eq("publication_id", publicationId).order("sort_order").order("id");
  const orderedItems = data ?? [];
  for (let index = 0; index < orderedItems.length; index += 1) {
    const item = orderedItems[index];
    await admin.from("publication_media").update({ sort_order: index }).eq("id", item.id);
  }
}

export async function mutateBusinessPublicationMediaAction(formData: FormData): Promise<void> {
  const parsed = z.object({
    publicationId: postgresUuidSchema,
    mediaId: postgresUuidSchema,
    intent: z.enum(["up", "down", "cover", "delete"])
  }).safeParse({
    publicationId: value(formData, "publicationId"),
    mediaId: value(formData, "mediaId"),
    intent: value(formData, "intent")
  });
  if (!parsed.success) return;
  const { admin, publication } = await publicationContext(parsed.data.publicationId);
  const { data: items } = await admin.from("publication_media")
    .select("id, media_asset_id, sort_order, media_assets(bucket_id, storage_path)")
    .eq("publication_id", publication.id).order("sort_order").order("id");
  const index = (items ?? []).findIndex((item) => item.id === parsed.data.mediaId);
  if (index < 0) return;
  const selected = items![index];
  if (parsed.data.intent === "delete") {
    await admin.from("publication_media").delete().eq("id", selected.id);
    await admin.from("media_assets").update({ deleted_at: new Date().toISOString() }).eq("id", selected.media_asset_id);
    const asset = Array.isArray(selected.media_assets) ? selected.media_assets[0] : selected.media_assets;
    if (asset) await admin.storage.from(asset.bucket_id).remove([asset.storage_path]);
    await normalizeOrder(publication.id);
  } else {
    const target = parsed.data.intent === "cover" ? 0 : parsed.data.intent === "up"
      ? Math.max(0, index - 1)
      : Math.min(items!.length - 1, index + 1);
    const ids = items!.map((item) => item.id);
    ids.splice(index, 1);
    ids.splice(target, 0, selected.id);
    for (let position = 0; position < ids.length; position += 1) {
      const id = ids[position];
      await admin.from("publication_media").update({ sort_order: 100 + position }).eq("id", id);
    }
    for (let position = 0; position < ids.length; position += 1) {
      const id = ids[position];
      await admin.from("publication_media").update({ sort_order: position }).eq("id", id);
    }
  }
  refresh(publication.id, publication.slug);
}
