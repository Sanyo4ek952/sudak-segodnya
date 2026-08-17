import "server-only";
import { z } from "zod";

const resolvedMediaSchema = z.object({
  kind: z.enum(["video", "clip"]),
  ownerId: z.string(),
  videoId: z.string(),
  externalId: z.string(),
  sourceUrl: z.string().url(),
  embedUrl: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  title: z.string().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable()
});

const resolverResponseSchema = z.object({
  results: z.array(z.discriminatedUnion("status", [
    z.object({
      sourceUrl: z.string(),
      status: z.literal("ready"),
      media: resolvedMediaSchema
    }),
    z.object({
      sourceUrl: z.string(),
      status: z.literal("error"),
      error: z.string()
    })
  ])).max(10)
});

export type ResolvedVkMedia = z.infer<typeof resolvedMediaSchema>;
export type VkMediaResolveResult = z.infer<typeof resolverResponseSchema>["results"][number];

export function publicationMediaWritesEnabled() {
  return process.env.PUBLICATION_MEDIA_WRITES_ENABLED !== "false";
}

export async function resolveVkMedia(urls: string[]): Promise<VkMediaResolveResult[]> {
  if (!publicationMediaWritesEnabled()) {
    throw new Error("Publication media writes are temporarily disabled.");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const internalSecret = process.env.VK_IMPORT_INTERNAL_SECRET?.trim();
  if (!supabaseUrl || !anonKey || !internalSecret) {
    throw new Error("VK media resolver credentials are not configured.");
  }
  if (urls.length === 0 || urls.length > 10) throw new Error("Resolve from 1 to 10 VK media links.");

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/vk-media-resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${internalSecret}`
      },
      body: JSON.stringify({ urls }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000)
    });
  } catch {
    throw new Error("VK media resolver is unavailable.");
  }
  if (response.status === 401) throw new Error("VK media resolver rejected the request.");
  if (!response.ok) throw new Error("VK media resolver returned an invalid response.");

  const parsed = resolverResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success || parsed.data.results.length !== urls.length) {
    throw new Error("VK media resolver returned an invalid result.");
  }
  return parsed.data.results;
}
