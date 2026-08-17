export type VkDirectVideoLink = {
  kind: "video" | "clip";
  ownerId: string;
  videoId: string;
  externalId: string;
  sourceUrl: string;
};

export type ResolvedVkVideo = VkDirectVideoLink & {
  embedUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nullableText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) || null : null;
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonnegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function parseVkDirectVideoUrl(value: string): VkDirectVideoLink | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || !["vk.com", "www.vk.com", "vk.ru", "www.vk.ru"].includes(hostname)
  ) return null;

  const match = url.pathname.match(/^\/(video|clip)(-?[1-9][0-9]*)_([1-9][0-9]*)\/?$/i);
  if (!match) return null;
  const kind = match[1].toLowerCase() as "video" | "clip";
  const ownerId = match[2];
  const videoId = match[3];
  const accessKey = url.searchParams.get("access_key")?.trim();
  const canonical = new URL(`https://vk.com/${kind}${ownerId}_${videoId}`);
  if (accessKey) canonical.searchParams.set("access_key", accessKey.slice(0, 200));
  return {
    kind,
    ownerId,
    videoId,
    externalId: `${ownerId}_${videoId}`,
    sourceUrl: canonical.toString()
  };
}

export function validateVkEmbedUrl(value: unknown) {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value.replace(/&amp;/g, "&").trim());
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || !["vk.com", "www.vk.com", "vk.ru", "www.vk.ru", "vkvideo.ru", "www.vkvideo.ru"].includes(hostname)
    || url.pathname !== "/video_ext.php"
  ) return null;
  url.searchParams.delete("autoplay");
  url.searchParams.delete("autoplay_muted");
  return url.toString();
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

export function extractVkIframeSrc(html: unknown) {
  if (typeof html !== "string" || html.length > 50_000) return null;
  const iframes = html.match(/<iframe\b[^>]*>/gi) ?? [];
  if (iframes.length !== 1) return null;
  const match = iframes[0].match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
  return match ? validateVkEmbedUrl(decodeHtmlAttribute(match[2])) : null;
}

function httpsThumbnail(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function fallbackVkEmbedUrl(direct: VkDirectVideoLink) {
  if (new URL(direct.sourceUrl).searchParams.has("access_key")) return null;
  const embed = new URL("https://vk.com/video_ext.php");
  embed.searchParams.set("oid", direct.ownerId);
  embed.searchParams.set("id", direct.videoId);
  embed.searchParams.set("hd", "1");
  return embed.toString();
}

function oembedMethodIsUnavailable(message: string) {
  return /method is (not )?available.*profile type/i.test(message);
}

export async function resolveVkVideoLink({
  sourceUrl,
  accessToken,
  fetchImpl = fetch,
  timeoutMs = 12_000
}: {
  sourceUrl: string;
  accessToken: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<ResolvedVkVideo> {
  const direct = parseVkDirectVideoUrl(sourceUrl);
  if (!direct) throw new Error("Only direct public VK video or clip links are supported");

  const requestUrl = new URL("https://api.vk.com/method/video.getOembed");
  requestUrl.searchParams.set("url", direct.sourceUrl);
  requestUrl.searchParams.set("access_token", accessToken);
  requestUrl.searchParams.set("v", "5.199");

  let response: Response;
  try {
    response = await fetchImpl(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch {
    throw new Error("VK video resolver is unavailable");
  }
  if (!response.ok) throw new Error(`VK video resolver returned HTTP ${response.status}`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("VK video resolver returned invalid JSON");
  }
  if (!isRecord(payload)) throw new Error("VK video resolver returned an invalid response");
  if (isRecord(payload.error)) {
    const message = nullableText(payload.error.error_msg, 300) ?? "video is unavailable";
    const fallbackEmbedUrl = oembedMethodIsUnavailable(message) ? fallbackVkEmbedUrl(direct) : null;
    if (fallbackEmbedUrl) {
      return {
        ...direct,
        embedUrl: fallbackEmbedUrl,
        thumbnailUrl: null,
        title: null,
        width: null,
        height: null,
        durationSeconds: null
      };
    }
    throw new Error(`VK could not resolve this video: ${message}`);
  }
  const oembed = isRecord(payload.response) ? payload.response : payload;
  const embedUrl = extractVkIframeSrc(oembed.html);
  if (!embedUrl) throw new Error("VK returned an unsupported player URL");

  return {
    ...direct,
    embedUrl,
    thumbnailUrl: httpsThumbnail(oembed.thumbnail_url),
    title: nullableText(oembed.title, 300),
    width: positiveInteger(oembed.width),
    height: positiveInteger(oembed.height),
    durationSeconds: nonnegativeInteger(oembed.duration)
  };
}
