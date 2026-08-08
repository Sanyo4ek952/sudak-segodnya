import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import {
  fetchVkWall,
  runVkSourceImports,
  type NormalizedVkPost,
  type VkExternalSource
} from "../_shared/vk.ts";

const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
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
    fetchPosts: (source) => fetchVkWall({ domain: source.domain, accessToken, count: 20 }),
    persistPosts: async (source, posts: NormalizedVkPost[]) => {
      if (posts.length === 0) return 0;
      const { data, error } = await supabase
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
      return data?.length ?? 0;
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
