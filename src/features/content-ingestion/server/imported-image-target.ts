import type { TablesInsert } from "@/shared/api/supabase/database.types";

export type ImportedImageOwner =
  | { kind: "organization"; id: string; altText: string }
  | { kind: "publication"; id: string; altText: string };

export function getImportedImageTarget(
  owner: ImportedImageOwner,
  contentHash: string,
  extension: "jpg" | "png" | "webp"
) {
  if (owner.kind === "organization") {
    return {
      bucketId: "organization-images" as const,
      purpose: "organization_cover" as const,
      ownerColumn: "organization_id" as const,
      storagePath: `organizations/${owner.id}/organization_cover-${contentHash}.${extension}`
    };
  }
  return {
    bucketId: "publication-images" as const,
    purpose: "publication_photo" as const,
    ownerColumn: "publication_id" as const,
    storagePath: `publications/${owner.id}/${contentHash}.${extension}`
  };
}

export function importedImageIsUnchanged(
  previous: { content_hash: string | null } | null,
  contentHash: string
) {
  return previous?.content_hash === contentHash;
}

export function getImportedMediaAssetInsert({
  owner,
  contentHash,
  extension,
  mimeType,
  sizeBytes,
  uploadedBy
}: {
  owner: ImportedImageOwner;
  contentHash: string;
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  uploadedBy: string;
}): TablesInsert<"media_assets"> {
  const target = getImportedImageTarget(owner, contentHash, extension);
  const ownerReference = owner.kind === "organization"
    ? { organization_id: owner.id, publication_id: null }
    : { organization_id: null, publication_id: owner.id };
  return {
    bucket_id: target.bucketId,
    storage_path: target.storagePath,
    purpose: target.purpose,
    visibility: "public" as const,
    ...ownerReference,
    alt_text: owner.altText,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    content_hash: contentHash,
    sort_order: 0,
    uploaded_by: uploadedBy
  };
}
