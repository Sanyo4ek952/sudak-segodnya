import { describe, expect, it, vi } from "vitest";
import {
  extractVkIframeSrc,
  parseVkDirectVideoUrl,
  resolveVkVideoLink,
  validateVkEmbedUrl
} from "../../../../supabase/functions/_shared/vk-embed";

describe("VK video link validation", () => {
  it.each([
    ["https://vk.com/video-123_456", "video"],
    ["https://www.vk.ru/clip123_456?access_key=public-key", "clip"]
  ])("accepts a direct link %s", (url, kind) => {
    expect(parseVkDirectVideoUrl(url)).toMatchObject({ kind, externalId: expect.any(String) });
  });

  it.each([
    "http://vk.com/video-1_2",
    "https://evil.example/video-1_2",
    "https://vk.com/wall-1_2",
    "https://vk.com/videos-1"
  ])("rejects unsupported source %s", (url) => {
    expect(parseVkDirectVideoUrl(url)).toBeNull();
  });

  it("allows only the official VK player path", () => {
    expect(validateVkEmbedUrl("https://vk.com/video_ext.php?oid=-1&id=2")).toContain("video_ext.php");
    expect(validateVkEmbedUrl("https://vk.com/away.php?to=https://evil.example")).toBeNull();
    expect(validateVkEmbedUrl("https://vk.com.evil.example/video_ext.php?id=2")).toBeNull();
  });

  it("extracts one safe iframe without returning oEmbed HTML", () => {
    expect(extractVkIframeSrc(
      '<iframe src="https://vk.com/video_ext.php?oid=-1&amp;id=2" allowfullscreen></iframe>'
    )).toBe("https://vk.com/video_ext.php?oid=-1&id=2");
    expect(extractVkIframeSrc(
      '<iframe src="https://evil.example/embed"></iframe><iframe src="https://vk.com/video_ext.php?id=2"></iframe>'
    )).toBeNull();
  });
});

describe("VK video resolver", () => {
  it("returns only validated metadata from video.getOembed", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = new URL(input);
      expect(url.pathname).toBe("/method/video.getOembed");
      expect(url.searchParams.get("access_token")).toBe("secret-token");
      return new Response(JSON.stringify({ response: {
        html: '<iframe src="https://vk.com/video_ext.php?oid=-7&amp;id=9"></iframe>',
        thumbnail_url: "https://sun9-1.userapi.com/poster.jpg",
        title: "Крым",
        width: 1280,
        height: 720
      } }), { status: 200, headers: { "content-type": "application/json" } });
    });

    await expect(resolveVkVideoLink({
      sourceUrl: "https://vk.com/video-7_9",
      accessToken: "secret-token",
      fetchImpl
    })).resolves.toEqual(expect.objectContaining({
      kind: "video",
      embedUrl: "https://vk.com/video_ext.php?oid=-7&id=9",
      thumbnailUrl: "https://sun9-1.userapi.com/poster.jpg"
    }));
  });

  it("falls back to a public VK embed when oEmbed is unavailable for the token profile", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: {
      error_msg: "Method is not available for this profile type: method is unavailable with current profile type"
    } }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(resolveVkVideoLink({
      sourceUrl: "https://vk.com/video-7_9",
      accessToken: "secret-token",
      fetchImpl
    })).resolves.toMatchObject({
      embedUrl: "https://vk.com/video_ext.php?oid=-7&id=9&hd=1",
      thumbnailUrl: null
    });
  });

  it("rejects malicious iframe HTML and hides credentials from errors", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ response: {
      html: '<iframe src="https://evil.example/player"></iframe>'
    } }), { status: 200 }));
    await expect(resolveVkVideoLink({
      sourceUrl: "https://vk.com/clip-7_9",
      accessToken: "super-secret",
      fetchImpl
    })).rejects.not.toThrow(/super-secret/);
  });
});
