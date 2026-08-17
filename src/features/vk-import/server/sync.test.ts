import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { invokeVkImport } from "@/features/vk-import/server/sync";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("VK import response compatibility", () => {
  it("accepts the legacy response without media counters", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("VK_IMPORT_INTERNAL_SECRET", "internal-secret");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      sourceCount: 1,
      succeededCount: 1,
      failedCount: 0,
      discoveredCount: 2,
      insertedCount: 1,
      results: [{
        sourceId: "11111111-1111-4111-8111-111111111111",
        status: "succeeded",
        discoveredCount: 2,
        insertedCount: 1,
        error: null
      }]
    }), { status: 200, headers: { "content-type": "application/json" } })));

    await expect(invokeVkImport()).resolves.toMatchObject({
      savedMediaCount: 0,
      failedMediaCount: 0,
      results: [{ savedMediaCount: 0, failedMediaCount: 0 }]
    });
  });
});
