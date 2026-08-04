import { describe, expect, it } from "vitest";
import { normalizeSourceUrl } from "@/features/content-ingestion/server/secure-fetch";
import {
  MAX_IMPORTED_IMAGE_BYTES,
  validateImageFile
} from "@/features/content-ingestion/server/secure-image";

describe("secure imported image validation", () => {
  it.each([
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00]), "jpg"],
    ["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png"],
    ["image/webp", Buffer.from("RIFF0000WEBP", "ascii"), "webp"]
  ])("accepts a valid %s signature", (mimeType, bytes, extension) => {
    const result = validateImageFile(bytes, mimeType);
    expect(result.extension).toBe(extension);
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a MIME/signature mismatch and damaged content", () => {
    expect(() => validateImageFile(Buffer.from("not-an-image"), "image/jpeg"))
      .toThrow(/Сигнатура/);
    expect(() => validateImageFile(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png"))
      .toThrow(/Сигнатура/);
  });

  it("rejects unsupported MIME types and files over 5 MB", () => {
    expect(() => validateImageFile(Buffer.from([0x47, 0x49, 0x46]), "image/gif"))
      .toThrow(/JPEG, PNG и WebP/);
    expect(() => validateImageFile(
      Buffer.alloc(MAX_IMPORTED_IMAGE_BYTES + 1, 0xff),
      "image/jpeg"
    )).toThrow(/5 МБ/);
  });

  it("inherits HTTPS-only and private-address SSRF protection", () => {
    expect(() => normalizeSourceUrl("http://images.example.org/photo.jpg")).toThrow(/HTTPS/);
    expect(() => normalizeSourceUrl("https://127.0.0.1/photo.jpg")).toThrow(/Приватные/);
  });
});
