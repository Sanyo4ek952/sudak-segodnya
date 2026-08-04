import { describe, expect, it } from "vitest";
import {
  getImportedMediaAssetInsert,
  getImportedImageTarget,
  importedImageIsUnchanged
} from "@/features/content-ingestion/server/imported-image-target";

const hash = "a".repeat(64);

describe("imported image ownership and deduplication", () => {
  it("binds organization images to the existing private organization bucket", () => {
    expect(getImportedImageTarget(
      { kind: "organization", id: "organization-id", altText: "Фото организации" },
      hash,
      "webp"
    )).toEqual({
      bucketId: "organization-images",
      purpose: "organization_cover",
      ownerColumn: "organization_id",
      storagePath: `organizations/organization-id/organization_cover-${hash}.webp`
    });
    expect(getImportedMediaAssetInsert({
      owner: { kind: "organization", id: "organization-id", altText: "Фото организации" },
      contentHash: hash,
      extension: "webp",
      mimeType: "image/webp",
      sizeBytes: 120,
      uploadedBy: "admin-id"
    })).toMatchObject({
      organization_id: "organization-id",
      purpose: "organization_cover",
      alt_text: "Фото организации",
      content_hash: hash
    });
  });

  it("binds publication images to the existing private publication bucket", () => {
    expect(getImportedImageTarget(
      { kind: "publication", id: "publication-id", altText: "Изображение публикации" },
      hash,
      "jpg"
    )).toEqual({
      bucketId: "publication-images",
      purpose: "publication_photo",
      ownerColumn: "publication_id",
      storagePath: `publications/publication-id/${hash}.jpg`
    });
    expect(getImportedMediaAssetInsert({
      owner: { kind: "publication", id: "publication-id", altText: "Изображение публикации" },
      contentHash: hash,
      extension: "jpg",
      mimeType: "image/jpeg",
      sizeBytes: 240,
      uploadedBy: "admin-id"
    })).toMatchObject({
      publication_id: "publication-id",
      purpose: "publication_photo",
      alt_text: "Изображение публикации",
      content_hash: hash
    });
  });

  it("skips replacement only when the content hash is unchanged", () => {
    expect(importedImageIsUnchanged({ content_hash: hash }, hash)).toBe(true);
    expect(importedImageIsUnchanged({ content_hash: "b".repeat(64) }, hash)).toBe(false);
    expect(importedImageIsUnchanged(null, hash)).toBe(false);
  });
});
