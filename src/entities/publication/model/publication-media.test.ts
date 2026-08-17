import { describe, expect, it } from "vitest";
import type { PublicationMedia } from "@/entities/publication/model/types";

function validateGallery(media: PublicationMedia[]) {
  if (media.length > 10) return false;
  return media.every((item) => item.kind === "photo" || (
    item.provider === "vk"
    && item.sourceUrl.startsWith("https://vk.com/")
    && item.embedUrl.startsWith("https://")
  ));
}

describe("publication media contract", () => {
  it("limits a gallery to ten items", () => {
    const photo: PublicationMedia = { id: "photo", kind: "photo", posterUrl: "/photo.jpg" };
    expect(validateGallery(Array.from({ length: 10 }, (_, index) => ({ ...photo, id: String(index) })))).toBe(true);
    expect(validateGallery(Array.from({ length: 11 }, (_, index) => ({ ...photo, id: String(index) })))).toBe(false);
  });

  it("requires VK playback fields for video", () => {
    expect(validateGallery([{
      id: "video",
      kind: "video",
      provider: "vk",
      posterUrl: "/poster.jpg",
      sourceUrl: "https://vk.com/video-1_2",
      embedUrl: "https://vk.com/video_ext.php?oid=-1&id=2"
    }])).toBe(true);
  });
});
