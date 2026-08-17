import {
  fetchValidatedImage,
  validateImageFile,
  type ValidatedImage
} from "@/features/content-ingestion/server/secure-image";
import {
  getImportedMediaAssetInsert,
  getImportedImageTarget,
  importedImageIsUnchanged,
  type ImportedImageOwner
} from "@/features/content-ingestion/server/imported-image-target";
import { createSupabaseAdminClient } from "@/shared/api/supabase/admin";

export const IMAGE_IMPORT_WARNING_PREFIX = "Импорт изображения:";

async function persistCandidateImage({
  image,
  owner,
  uploadedBy
}: {
  image: ValidatedImage;
  owner: ImportedImageOwner;
  uploadedBy: string;
}) {
  const target = getImportedImageTarget(owner, image.contentHash, image.extension);
  const admin = createSupabaseAdminClient();
  const { data: previous, error: previousError } = await admin
    .from("media_assets")
    .select("id, bucket_id, storage_path, content_hash")
    .eq(target.ownerColumn, owner.id)
    .eq("purpose", target.purpose)
    .is("deleted_at", null)
    .maybeSingle();
  if (previousError) throw new Error("Не удалось проверить текущее изображение материала.");
  if (importedImageIsUnchanged(previous, image.contentHash)) {
    return { status: "unchanged" as const, contentHash: image.contentHash };
  }

  const { error: uploadError } = await admin.storage
    .from(target.bucketId)
    .upload(target.storagePath, image.bytes, {
      contentType: image.mimeType,
      upsert: true
    });
  if (uploadError) throw new Error("Не удалось загрузить изображение в приватное хранилище.");

  const replacedAt = new Date().toISOString();
  if (previous) {
    const { error } = await admin
      .from("media_assets")
      .update({ deleted_at: replacedAt })
      .eq("id", previous.id);
    if (error) {
      await admin.storage.from(target.bucketId).remove([target.storagePath]);
      throw new Error("Не удалось подготовить замену текущего изображения.");
    }
  }

  const { error: assetError } = await admin.from("media_assets").insert(
    getImportedMediaAssetInsert({
      owner,
      contentHash: image.contentHash,
      extension: image.extension,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      uploadedBy
    })
  );
  if (assetError) {
    if (previous) {
      await admin.from("media_assets").update({ deleted_at: null }).eq("id", previous.id);
    }
    await admin.storage.from(target.bucketId).remove([target.storagePath]);
    throw new Error("Не удалось связать импортированное изображение с материалом.");
  }

  if (previous && previous.storage_path !== target.storagePath) {
    await admin.storage.from(previous.bucket_id).remove([previous.storage_path]);
  }

  return {
    status: previous ? "replaced" as const : "created" as const,
    contentHash: image.contentHash
  };
}

export async function importCandidateImage({
  sourceUrl,
  owner,
  uploadedBy,
  fetchImage = fetchValidatedImage
}: {
  sourceUrl: string;
  owner: ImportedImageOwner;
  uploadedBy: string;
  fetchImage?: typeof fetchValidatedImage;
}) {
  return persistCandidateImage({ image: await fetchImage(sourceUrl), owner, uploadedBy });
}

export async function importCandidateImageBytes({
  bytes,
  contentType,
  owner,
  uploadedBy
}: {
  bytes: Buffer;
  contentType: string;
  owner: ImportedImageOwner;
  uploadedBy: string;
}) {
  return persistCandidateImage({
    image: validateImageFile(bytes, contentType),
    owner,
    uploadedBy
  });
}

export async function importCandidateImageFromStorage({
  bucketId,
  storagePath,
  owner,
  uploadedBy
}: {
  bucketId: string;
  storagePath: string;
  owner: ImportedImageOwner;
  uploadedBy: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(bucketId).download(storagePath);
  if (error || !data) throw new Error("Не удалось прочитать сохранённое изображение источника.");
  return importCandidateImageBytes({
    bytes: Buffer.from(await data.arrayBuffer()),
    contentType: data.type,
    owner,
    uploadedBy
  });
}
