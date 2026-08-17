import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  fetchVkMediaImage,
  maxVkImportedImageBytes,
  validateVkMediaImage
} from "../../../../supabase/functions/_shared/vk-media";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("VK staged media validation", () => {
  it("keeps the supplied Sudak fallback image as a valid PNG", async () => {
    const bytes = readFileSync(join(process.cwd(), "public", "brand", "vk-import-fallback.png"));
    const result = await validateVkMediaImage(Uint8Array.from(bytes), "image/png");
    expect(result).toMatchObject({
      contentHash: "da728fce722364d52880827b7898fff21ac3e9446f9c35450020a1d784f4acbe",
      sizeBytes: 1_511_874
    });
  });

  it("validates a VK CDN image and calculates a stable content hash", async () => {
    const fetchImpl = vi.fn(async () => new Response(pngBytes, {
      status: 200,
      headers: { "content-type": "image/png" }
    }));

    const result = await fetchVkMediaImage({
      sourceUrl: "https://sun9-1.userapi.com/photo.png",
      fetchImpl
    });

    expect(result).toMatchObject({
      mimeType: "image/png",
      extension: "png",
      sizeBytes: pngBytes.length
    });
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("allows the exact OK CDN host used by VK video posters", async () => {
    const fetchImpl = vi.fn(async () => new Response(pngBytes, {
      status: 200,
      headers: { "content-type": "image/png" }
    }));

    await expect(fetchVkMediaImage({
      sourceUrl: "https://iv.okcdn.ru/video-preview.png",
      fetchImpl
    })).resolves.toMatchObject({ mimeType: "image/png" });

    await expect(fetchVkMediaImage({
      sourceUrl: "https://untrusted.iv.okcdn.ru/video-preview.png",
      fetchImpl
    })).rejects.toThrow(/not allowed/);
  });

  it("rejects non-VK hosts before a network request", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchVkMediaImage({
      sourceUrl: "https://example.org/photo.jpg",
      fetchImpl
    })).rejects.toThrow(/not allowed/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects redirects outside the VK media allowlist", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "https://127.0.0.1/private.png" }
    }));
    await expect(fetchVkMediaImage({
      sourceUrl: "https://sun9-1.userapi.com/photo.png",
      fetchImpl
    })).rejects.toThrow(/not allowed/);
  });

  it("rejects MIME mismatches and files over 5 MB", async () => {
    await expect(validateVkMediaImage(pngBytes, "image/jpeg")).rejects.toThrow(/signature/);
    await expect(validateVkMediaImage(
      new Uint8Array(maxVkImportedImageBytes + 1),
      "image/jpeg"
    )).rejects.toThrow(/5 MB/);
  });
});
