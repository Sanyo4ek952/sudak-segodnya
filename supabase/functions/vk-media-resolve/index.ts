import { resolveVkVideoLink } from "../_shared/vk-embed.ts";

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
  const accessToken = Deno.env.get("VK_ACCESS_TOKEN")?.trim();
  if (!accessToken) return json({ error: "VK resolver is not configured" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const urls = typeof body === "object" && body !== null && Array.isArray((body as { urls?: unknown }).urls)
    ? (body as { urls: unknown[] }).urls
    : null;
  if (!urls || urls.length === 0 || urls.length > 10 || urls.some((url) => typeof url !== "string" || url.length > 1000)) {
    return json({ error: "Provide from 1 to 10 VK video links" }, 400);
  }

  const results = await Promise.all(urls.map(async (sourceUrl) => {
    try {
      return { sourceUrl, status: "ready" as const, media: await resolveVkVideoLink({ sourceUrl, accessToken }) };
    } catch (error) {
      return {
        sourceUrl,
        status: "error" as const,
        error: error instanceof Error ? error.message.slice(0, 500) : "VK video could not be resolved"
      };
    }
  }));
  return json({ results }, results.some((result) => result.status === "error") ? 207 : 200);
});
