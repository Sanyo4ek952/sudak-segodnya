import { describe, expect, it, vi } from "vitest";
import {
  getVkImportAvailability,
  normalizeVkDomain,
  vkManualImportCooldownMs,
  vkManualImportStaleAfterMs
} from "@/features/vk-import/model/types";
import {
  buildVkPostUrl,
  fetchVkWall,
  filterFreshVkPosts,
  isFreshVkPost,
  normalizeVkPost,
  normalizeVkWallResponse,
  runVkSourceImports,
  selectLargestVkPhotoSize,
  VkApiError,
  type NormalizedVkPost,
  type VkExternalSource
} from "../../../../supabase/functions/_shared/vk";

describe("VK manual import availability", () => {
  const now = Date.parse("2026-08-10T12:00:00.000Z");

  it("allows the first manual import", () => {
    expect(getVkImportAvailability([], now)).toEqual({
      canRun: true,
      state: "available",
      lastStartedAt: null,
      nextAvailableAt: null
    });
  });

  it("blocks another click while an import is running", () => {
    const startedAt = new Date(now - vkManualImportStaleAfterMs + 1).toISOString();
    expect(getVkImportAvailability([{
      status: "running",
      startedAt,
      finishedAt: null
    }], now)).toMatchObject({
      canRun: false,
      state: "running",
      lastStartedAt: startedAt
    });
  });

  it("allows a replacement claim when a running import is stale", () => {
    const startedAt = new Date(now - vkManualImportStaleAfterMs).toISOString();
    expect(getVkImportAvailability([{
      status: "running",
      startedAt,
      finishedAt: null
    }], now)).toMatchObject({
      canRun: true,
      state: "available",
      lastStartedAt: startedAt,
      nextAvailableAt: null
    });
  });

  it("keeps a one-minute cooldown after a successful import", () => {
    const finishedAt = new Date(now - vkManualImportCooldownMs + 1).toISOString();
    expect(getVkImportAvailability([{
      status: "succeeded",
      startedAt: "2026-08-10T11:58:00.000Z",
      finishedAt
    }], now)).toMatchObject({
      canRun: false,
      state: "cooldown"
    });
  });

  it("allows the next click exactly one minute after success", () => {
    const finishedAt = new Date(now - vkManualImportCooldownMs).toISOString();
    expect(getVkImportAvailability([{
      status: "succeeded",
      startedAt: "2026-08-10T11:58:00.000Z",
      finishedAt
    }], now)).toMatchObject({
      canRun: true,
      state: "available",
      nextAvailableAt: null
    });
  });

  it("allows an immediate retry after a failed import", () => {
    expect(getVkImportAvailability([{
      status: "failed",
      startedAt: "2026-08-10T11:59:30.000Z",
      finishedAt: "2026-08-10T11:59:45.000Z"
    }], now)).toMatchObject({
      canRun: true,
      state: "available"
    });
  });
});

describe("VK source domain normalization", () => {
  it.each([
    "https://vk.ru/okrugsudak",
    "https://www.vk.ru/okrugsudak",
    "https://vk.com/okrugsudak",
    "okrugsudak"
  ])("accepts %s", (value) => {
    expect(normalizeVkDomain(value)).toBe("okrugsudak");
  });

  it("rejects links outside the VK hostname allowlist", () => {
    expect(normalizeVkDomain("https://example.com/okrugsudak")).toBeNull();
  });
});

const source: VkExternalSource = {
  id: "00000000-0000-0000-0000-000000000901",
  domain: "sudak_today",
  externalId: "-101"
};

const post: NormalizedVkPost = {
  externalId: "77",
  ownerId: "-101",
  sourceUrl: "https://vk.com/wall-101_77",
  text: "Городская новость",
  publishedAt: "2026-08-08T09:00:00.000Z",
  media: [],
  rawPayload: { id: 77, owner_id: -101 }
};

describe("VK normalization", () => {
  it("builds the canonical VK post URL", () => {
    expect(buildVkPostUrl(-12345, 678)).toBe("https://vk.com/wall-12345_678");
  });

  it("selects the largest valid HTTPS photo size", () => {
    expect(selectLargestVkPhotoSize([
      { url: "https://sun.example/small.jpg", width: 320, height: 240 },
      { url: "http://sun.example/insecure.jpg", width: 4096, height: 2160 },
      { url: "https://sun.example/large.jpg", width: 1280, height: 960 }
    ])).toMatchObject({
      sourceUrl: "https://sun.example/large.jpg",
      width: 1280,
      height: 960
    });
  });

  it("normalizes top-level text and photos without traversing repost payloads", () => {
    const normalized = normalizeVkPost({
      id: 77,
      owner_id: -101,
      date: 1_786_177_600,
      text: "  Важная новость  ",
      attachments: [{
        type: "photo",
        photo: {
          id: 5,
          owner_id: -101,
          sizes: [
            { url: "https://sun.example/1.jpg", width: 640, height: 480 },
            { url: "https://sun.example/2.jpg", width: 1600, height: 1200 }
          ]
        }
      }],
      copy_history: [{
        id: 2,
        owner_id: -202,
        text: "Текст исходного репоста",
        attachments: [{ type: "photo", photo: { sizes: [{ url: "https://sun.example/repost.jpg", width: 2000, height: 1500 }] } }]
      }]
    });

    expect(normalized).toMatchObject({
      externalId: "77",
      ownerId: "-101",
      sourceUrl: "https://vk.com/wall-101_77",
      text: "Важная новость"
    });
    expect(normalized?.media).toEqual([expect.objectContaining({
      sourceUrl: "https://sun.example/2.jpg",
      externalId: "-101_5"
    })]);
  });

  it("skips a repost that has no original top-level content", () => {
    expect(normalizeVkPost({
      id: 78,
      owner_id: -101,
      date: 1_786_177_600,
      text: "",
      copy_history: [{ id: 2, owner_id: -202, text: "Чужой материал" }]
    })).toBeNull();
  });

  it("keeps a video-only post and selects the largest video poster", () => {
    const normalized = normalizeVkPost({
      id: 79,
      owner_id: -101,
      date: 1_786_177_600,
      text: "",
      attachments: [{
        type: "video",
        video: {
          id: 9,
          owner_id: -101,
          title: "Прогулка по Судаку",
          duration: 95,
          image: [
            { url: "https://sun9-1.userapi.com/video-small.jpg", width: 320, height: 180 },
            { url: "https://sun9-1.userapi.com/video-large.jpg", width: 1280, height: 720 }
          ],
          first_frame: [
            { url: "https://sun9-1.userapi.com/video-frame.jpg", width: 1920, height: 1080 }
          ]
        }
      }]
    });

    expect(normalized?.media).toEqual([expect.objectContaining({
      type: "video",
      attachmentType: "video",
      sourceUrl: "https://vk.com/video-101_9",
      previewSourceUrl: "https://sun9-1.userapi.com/video-large.jpg",
      previewSourceUrls: [
        "https://sun9-1.userapi.com/video-large.jpg",
        "https://sun9-1.userapi.com/video-small.jpg",
        "https://sun9-1.userapi.com/video-frame.jpg"
      ],
      externalId: "-101_9",
      durationSeconds: 95
    })]);
  });

  it("uses first_frame when a clip has no poster image", () => {
    const normalized = normalizeVkPost({
      id: 80,
      owner_id: -101,
      date: 1_786_177_600,
      text: "Клип",
      attachments: [{
        type: "clip",
        clip: {
          id: 10,
          owner_id: -101,
          first_frame: [{
            url: "https://sun9-1.userapi.com/clip-frame.jpg",
            width: 720,
            height: 1280
          }]
        }
      }]
    });

    expect(normalized?.media[0]).toMatchObject({
      type: "video",
      attachmentType: "clip",
      previewSourceUrl: "https://sun9-1.userapi.com/clip-frame.jpg"
    });
  });

  it("keeps a validated player, access key and short_video kind", () => {
    const normalized = normalizeVkPost({
      id: 81,
      owner_id: -101,
      date: 1_786_177_600,
      text: "Short",
      attachments: [{
        type: "video",
        video: {
          id: 11,
          owner_id: -101,
          type: "short_video",
          access_key: "public-key",
          player: "https://vk.com/video_ext.php?oid=-101&id=11",
          image: [{ url: "https://sun9-1.userapi.com/short.jpg", width: 720, height: 1280 }]
        }
      }]
    });

    expect(normalized?.media[0]).toMatchObject({
      type: "video",
      attachmentType: "clip",
      sourceUrl: "https://vk.com/video-101_11?access_key=public-key",
      embedUrl: "https://vk.com/video_ext.php?oid=-101&id=11",
      accessKey: "public-key"
    });
  });

  it("keeps only posts inside the seven-day freshness window", () => {
    const now = Date.parse("2026-08-09T12:00:00.000Z");
    const fresh = { ...post, publishedAt: "2026-08-02T12:00:00.001Z" };
    const stale = { ...post, externalId: "78", publishedAt: "2026-08-02T12:00:00.000Z" };

    expect(isFreshVkPost(fresh, now)).toBe(true);
    expect(isFreshVkPost(stale, now)).toBe(false);
    expect(filterFreshVkPosts([stale, fresh], now)).toEqual([fresh]);
  });

  it("deduplicates repeated post ids in one wall response", () => {
    const raw = { id: 77, owner_id: -101, date: 1_786_177_600, text: "Новость" };
    expect(normalizeVkWallResponse({ response: { items: [raw, raw] } })).toHaveLength(1);
  });

  it("turns VK API errors into a controlled error", () => {
    expect(() => normalizeVkWallResponse({
      error: { error_code: 5, error_msg: "User authorization failed" }
    })).toThrowError(new VkApiError("VK API error 5: User authorization failed", 5));
  });

  it("uses the required wall.get parameters", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = new URL(input);
      expect(url.origin + url.pathname).toBe("https://api.vk.com/method/wall.get");
      expect(url.searchParams.get("domain")).toBe("sudak_today");
      expect(url.searchParams.get("count")).toBe("20");
      expect(url.searchParams.get("filter")).toBe("owner");
      expect(url.searchParams.get("v")).toBe("5.199");
      expect(url.searchParams.get("access_token")).toBe("test-token");
      return new Response(JSON.stringify({ response: { count: 0, items: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    await expect(fetchVkWall({
      domain: "sudak_today",
      accessToken: "test-token",
      fetchImpl
    })).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("VK import orchestration", () => {
  it("is idempotent when the same source is imported repeatedly", async () => {
    const stored = new Set<string>();
    const persistPosts = async (currentSource: VkExternalSource, posts: NormalizedVkPost[]) => {
      let inserted = 0;
      for (const item of posts) {
        const key = `${currentSource.id}:${item.externalId}`;
        if (!stored.has(key)) {
          stored.add(key);
          inserted += 1;
        }
      }
      return { insertedCount: inserted, savedMediaCount: 0, failedMediaCount: 0 };
    };
    const dependencies = {
      sources: [source],
      fetchPosts: async () => [post],
      persistPosts,
      markSucceeded: async () => undefined,
      markFailed: async () => undefined
    };

    const first = await runVkSourceImports(dependencies);
    const second = await runVkSourceImports(dependencies);
    expect(first.insertedCount).toBe(1);
    expect(second.insertedCount).toBe(0);
    expect(stored.size).toBe(1);
  });

  it("continues after one source returns a VK API error", async () => {
    const secondSource: VkExternalSource = {
      id: "00000000-0000-0000-0000-000000000902",
      domain: "second_source",
      externalId: "-202"
    };
    const failedSources: string[] = [];
    const persistedSources: string[] = [];
    const result = await runVkSourceImports({
      sources: [source, secondSource],
      fetchPosts: async (currentSource) => {
        if (currentSource.id === source.id) throw new VkApiError("VK API error 6: Too many requests", 6);
        return [{ ...post, ownerId: "-202" }];
      },
      persistPosts: async (currentSource, posts) => {
        persistedSources.push(currentSource.id);
        return { insertedCount: posts.length, savedMediaCount: 1, failedMediaCount: 0 };
      },
      markSucceeded: async () => undefined,
      markFailed: async (currentSource) => {
        failedSources.push(currentSource.id);
      }
    });

    expect(result).toMatchObject({
      sourceCount: 2,
      succeededCount: 1,
      failedCount: 1,
      insertedCount: 1
    });
    expect(failedSources).toEqual([source.id]);
    expect(persistedSources).toEqual([secondSource.id]);
  });
});
