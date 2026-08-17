import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import {
  fetchVkWall,
  filterFreshVkPosts,
  runVkSourceImports,
  type NormalizedVkPost,
  type VkMedia,
  type VkExternalSource
} from "../_shared/vk.ts";
import { fetchVkMediaImage } from "../_shared/vk-media.ts";
import { resolveVkVideoLink } from "../_shared/vk-embed.ts";

const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

type VkMediaTask = {
  externalItemId: string;
  postExternalId: string;
  mediaKey: string;
  kind: "photo" | "video_preview";
  sourceUrl: string;
  sourceUrls: string[];
  width: number;
  height: number;
  sortOrder: number;
};

function safePathSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160) || "media";
}

function mediaTask(
  externalItemId: string,
  postExternalId: string,
  media: VkMedia,
  sortOrder: number
): VkMediaTask | null {
  const sourceUrl = media.type === "photo" ? media.sourceUrl : media.previewSourceUrl;
  if (!sourceUrl) return null;
  const sourceUrls = media.type === "photo"
    ? [sourceUrl]
    : media.previewSourceUrls.length > 0
      ? media.previewSourceUrls
      : [sourceUrl];
  return {
    externalItemId,
    postExternalId,
    mediaKey: `${media.type}:${media.externalId ?? sortOrder}`,
    kind: media.type === "photo" ? "photo" : "video_preview",
    sourceUrl,
    sourceUrls,
    width: media.width,
    height: media.height,
    sortOrder
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  callback: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(values[index]);
    }
  }));
  return results;
}

async function digestSecret(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function matchesInternalSecret(request: Request, expected: string | undefined) {
  const header = request.headers.get("authorization");
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const [receivedDigest, expectedDigest] = await Promise.all([
    digestSecret(header.slice(7)),
    digestSecret(expected)
  ]);
  let difference = receivedDigest.length ^ expectedDigest.length;
  for (let index = 0; index < Math.min(receivedDigest.length, expectedDigest.length); index += 1) {
    difference |= receivedDigest[index] ^ expectedDigest[index];
  }
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!await matchesInternalSecret(request, Deno.env.get("VK_IMPORT_INTERNAL_SECRET")?.trim())) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const accessToken = Deno.env.get("VK_ACCESS_TOKEN")?.trim();
  if (!supabaseUrl || !serviceRoleKey || !accessToken) {
    return json({ error: "VK import is not configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: sourceRows, error: sourceError } = await supabase
    .from("external_sources")
    .select("id, domain, external_id")
    .eq("platform", "vk")
    .eq("is_active", true)
    .order("id");
  if (sourceError) return json({ error: "Failed to load VK sources" }, 500);

  const sources: VkExternalSource[] = (sourceRows ?? []).map((source) => ({
    id: source.id,
    domain: source.domain,
    externalId: source.external_id
  }));

  const result = await runVkSourceImports({
    sources,
    fetchPosts: async (source) => filterFreshVkPosts(
      await fetchVkWall({ domain: source.domain, accessToken, count: 20 })
    ),
    persistPosts: async (source, posts: NormalizedVkPost[]) => {
      if (posts.length === 0) {
        return { insertedCount: 0, savedMediaCount: 0, failedMediaCount: 0 };
      }
      const unresolvedVideos = posts.flatMap((post) => post.media.filter((media) => (
        media.type === "video" && !media.embedUrl && media.sourceUrl
      )));
      await mapWithConcurrency(unresolvedVideos, 4, async (media) => {
        if (media.type !== "video" || !media.sourceUrl) return;
        try {
          const resolved = await resolveVkVideoLink({ sourceUrl: media.sourceUrl, accessToken });
          media.embedUrl = resolved.embedUrl;
          media.title = media.title ?? resolved.title;
          media.width = media.width || resolved.width || 0;
          media.height = media.height || resolved.height || 0;
          if (resolved.thumbnailUrl && !media.previewSourceUrls.includes(resolved.thumbnailUrl)) {
            media.previewSourceUrls.unshift(resolved.thumbnailUrl);
            media.previewSourceUrl = media.previewSourceUrl ?? resolved.thumbnailUrl;
          }
        } catch {
          media.resolveError = "VK-плеер недоступен. Повторите подготовку в редакторе кандидата.";
          // The post is still imported. This media item remains pending/error in
          // the candidate editor and can be prepared again independently.
        }
      });
      const { data: insertedRows, error } = await supabase
        .from("external_items")
        .upsert(posts.map((post) => ({
          source_id: source.id,
          external_id: post.externalId,
          source_url: post.sourceUrl,
          text: post.text,
          published_at: post.publishedAt,
          media: post.media,
          raw_payload: post.rawPayload,
          status: "new"
        })), {
          onConflict: "source_id,external_id",
          ignoreDuplicates: true
        })
        .select("id");
      if (error) throw new Error("Failed to store VK items");

      const externalIds = posts.map((post) => post.externalId);
      const { data: itemRows, error: itemError } = await supabase
        .from("external_items")
        .select("id, external_id")
        .eq("source_id", source.id)
        .in("status", ["new", "imported"])
        .in("external_id", externalIds);
      if (itemError) throw new Error("Failed to load stored VK items");

      const itemIdByExternalId = new Map((itemRows ?? []).map((item) => [item.external_id, item.id]));
      const itemIds = (itemRows ?? []).map((item) => item.id);
      const { data: existingMedia, error: existingMediaError } = itemIds.length > 0
        ? await supabase
          .from("external_item_media")
          .select("external_item_id, media_key")
          .in("external_item_id", itemIds)
        : { data: [], error: null };
      if (existingMediaError) throw new Error("Failed to load stored VK media");
      const existingKeys = new Set((existingMedia ?? []).map((media) => (
        `${media.external_item_id}:${media.media_key}`
      )));

      let unavailableMediaCount = 0;
      const mediaTasks: VkMediaTask[] = [];
      for (const post of posts) {
        const externalItemId = itemIdByExternalId.get(post.externalId);
        if (!externalItemId) continue;
        post.media.forEach((media, sortOrder) => {
          const task = mediaTask(externalItemId, post.externalId, media, sortOrder);
          if (!task) {
            unavailableMediaCount += 1;
            return;
          }
          if (!existingKeys.has(`${externalItemId}:${task.mediaKey}`)) mediaTasks.push(task);
        });
      }

      const stored = await mapWithConcurrency(mediaTasks, 4, async (task) => {
        try {
          let selectedSourceUrl = task.sourceUrl;
          let image: Awaited<ReturnType<typeof fetchVkMediaImage>> | null = null;
          for (const sourceUrl of task.sourceUrls) {
            try {
              image = await fetchVkMediaImage({ sourceUrl });
              selectedSourceUrl = sourceUrl;
              break;
            } catch {
              // VK video posters can contain expired CDN variants. Try the
              // remaining image and first-frame sizes before giving up.
            }
          }
          if (!image) throw new Error("VK media variants are unavailable");
          const storagePath = [
            "sources",
            source.id,
            "items",
            safePathSegment(task.postExternalId),
            `${safePathSegment(task.mediaKey)}-${image.contentHash}.${image.extension}`
          ].join("/");
          const { error: uploadError } = await supabase.storage
            .from("vk-import-media")
            .upload(storagePath, image.bytes, {
              contentType: image.mimeType,
              upsert: true
            });
          if (uploadError) throw new Error("Failed to upload VK media");

          const { error: mediaError } = await supabase.from("external_item_media").insert({
            external_item_id: task.externalItemId,
            media_key: task.mediaKey,
            kind: task.kind,
            source_url: selectedSourceUrl,
            bucket_id: "vk-import-media",
            storage_path: storagePath,
            width: task.width > 0 ? task.width : null,
            height: task.height > 0 ? task.height : null,
            mime_type: image.mimeType,
            size_bytes: image.sizeBytes,
            content_hash: image.contentHash,
            sort_order: task.sortOrder
          });
          if (mediaError) {
            await supabase.storage.from("vk-import-media").remove([storagePath]);
            throw new Error("Failed to link VK media");
          }
          return true;
        } catch {
          return false;
        }
      });

      return {
        insertedCount: insertedRows?.length ?? 0,
        savedMediaCount: stored.filter(Boolean).length,
        failedMediaCount: unavailableMediaCount + stored.filter((value) => !value).length
      };
    },
    markSucceeded: async (source, ownerId) => {
      const { error } = await supabase
        .from("external_sources")
        .update({
          external_id: source.externalId ?? ownerId,
          last_synced_at: new Date().toISOString(),
          last_sync_error: null
        })
        .eq("id", source.id);
      if (error) throw new Error("Failed to update VK source after import");
    },
    markFailed: async (source, errorMessage) => {
      await supabase
        .from("external_sources")
        .update({ last_sync_error: errorMessage })
        .eq("id", source.id);
    }
  });

  return json(result, result.failedCount > 0 ? 207 : 200);
});
