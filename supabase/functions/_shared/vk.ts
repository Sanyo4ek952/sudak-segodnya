export type VkExternalSource = {
  id: string;
  domain: string;
  externalId: string | null;
};

export type VkMediaPhoto = {
  type: "photo";
  sourceUrl: string;
  width: number;
  height: number;
  externalId: string | null;
};

export type VkMediaVideo = {
  type: "video";
  attachmentType: "video" | "clip";
  sourceUrl: string | null;
  embedUrl: string | null;
  accessKey: string | null;
  resolveError: string | null;
  previewSourceUrl: string | null;
  previewSourceUrls: string[];
  width: number;
  height: number;
  externalId: string | null;
  title: string | null;
  durationSeconds: number | null;
};

export type VkMedia = VkMediaPhoto | VkMediaVideo;

export type NormalizedVkPost = {
  externalId: string;
  ownerId: string;
  sourceUrl: string;
  text: string;
  publishedAt: string;
  media: VkMedia[];
  rawPayload: Record<string, unknown>;
};

export type VkSourceImportResult = {
  sourceId: string;
  status: "succeeded" | "failed";
  discoveredCount: number;
  insertedCount: number;
  savedMediaCount: number;
  failedMediaCount: number;
  error: string | null;
};

export type VkImportSummary = {
  sourceCount: number;
  succeededCount: number;
  failedCount: number;
  discoveredCount: number;
  insertedCount: number;
  savedMediaCount: number;
  failedMediaCount: number;
  results: VkSourceImportResult[];
};

export type VkPersistPostsResult = {
  insertedCount: number;
  savedMediaCount: number;
  failedMediaCount: number;
};

export const vkImportFreshnessMs = 7 * 24 * 60 * 60 * 1000;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function positiveDimension(value: unknown) {
  const parsed = integer(value);
  return parsed !== null && parsed > 0 ? parsed : 0;
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function vkEmbedUrl(value: unknown) {
  const parsedValue = httpsUrl(value);
  if (!parsedValue) return null;
  const parsed = new URL(parsedValue);
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !["vk.com", "www.vk.com", "vk.ru", "www.vk.ru", "vkvideo.ru", "www.vkvideo.ru"].includes(hostname)
    || parsed.pathname !== "/video_ext.php"
    || parsed.username
    || parsed.password
    || parsed.port
  ) return null;
  parsed.searchParams.delete("autoplay");
  parsed.searchParams.delete("autoplay_muted");
  return parsed.toString();
}

export class VkApiError extends Error {
  readonly code: number | null;

  constructor(message: string, code: number | null = null) {
    super(message);
    this.name = "VkApiError";
    this.code = code;
  }
}

export function buildVkPostUrl(ownerId: number, postId: number) {
  if (!Number.isSafeInteger(ownerId) || ownerId === 0 || !Number.isSafeInteger(postId) || postId <= 0) {
    throw new VkApiError("VK post identifiers are invalid");
  }
  return `https://vk.com/wall${ownerId}_${postId}`;
}

export function selectLargestVkPhotoSize(value: unknown): VkMediaPhoto | null {
  if (!Array.isArray(value)) return null;

  const sizes = value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const sourceUrl = httpsUrl(candidate.url);
    if (!sourceUrl) return [];
    const width = positiveDimension(candidate.width);
    const height = positiveDimension(candidate.height);
    return [{ type: "photo" as const, sourceUrl, width, height, externalId: null }];
  });

  return sizes.sort((left, right) => {
    const areaDifference = right.width * right.height - left.width * left.height;
    return areaDifference || right.width - left.width || right.height - left.height;
  })[0] ?? null;
}

function selectVkVideoImages(value: unknown) {
  if (!Array.isArray(value)) return null;

  const images = value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const sourceUrl = httpsUrl(candidate.url);
    if (!sourceUrl) return [];
    return [{
      sourceUrl,
      width: positiveDimension(candidate.width),
      height: positiveDimension(candidate.height)
    }];
  });

  return images.sort((left, right) => {
    const areaDifference = right.width * right.height - left.width * left.height;
    return areaDifference || right.width - left.width || right.height - left.height;
  });
}

function normalizePhotoAttachment(attachment: unknown): VkMediaPhoto | null {
  if (!isRecord(attachment) || attachment.type !== "photo" || !isRecord(attachment.photo)) {
    return null;
  }
  const selected = selectLargestVkPhotoSize(attachment.photo.sizes);
  if (!selected) return null;
  const ownerId = integer(attachment.photo.owner_id);
  const photoId = integer(attachment.photo.id);
  return {
    ...selected,
    externalId: ownerId !== null && photoId !== null ? `${ownerId}_${photoId}` : null
  };
}

function normalizeVideoAttachment(attachment: unknown): VkMediaVideo | null {
  if (
    !isRecord(attachment)
    || (attachment.type !== "video" && attachment.type !== "clip")
    || !isRecord(attachment[attachment.type])
  ) {
    return null;
  }

  const attachmentKey = attachment.type;
  const video = attachment[attachmentKey] as Record<string, unknown>;
  const attachmentType = attachmentKey === "clip" || video.type === "short_video" ? "clip" : "video";
  const sourcePath = attachmentKey === "clip" ? "clip" : "video";
  const ownerId = integer(video.owner_id);
  const videoId = integer(video.id);
  const previewCandidates = [
    ...(selectVkVideoImages(video.image) ?? []),
    ...(selectVkVideoImages(video.first_frame) ?? [])
  ].filter((candidate, index, candidates) => (
    candidates.findIndex((other) => other.sourceUrl === candidate.sourceUrl) === index
  ));
  const preview = previewCandidates[0] ?? null;
  const title = typeof video.title === "string" ? video.title.trim().slice(0, 300) || null : null;
  const duration = integer(video.duration);
  const accessKey = typeof video.access_key === "string"
    ? video.access_key.trim().slice(0, 200) || null
    : null;
  const player = vkEmbedUrl(video.player);

  return {
    type: "video",
    attachmentType,
    sourceUrl: ownerId !== null && ownerId !== 0 && videoId !== null && videoId > 0
      ? `https://vk.com/${sourcePath}${ownerId}_${videoId}${accessKey ? `?access_key=${encodeURIComponent(accessKey)}` : ""}`
      : null,
    embedUrl: player,
    accessKey,
    resolveError: null,
    previewSourceUrl: preview?.sourceUrl ?? null,
    previewSourceUrls: previewCandidates.map((candidate) => candidate.sourceUrl),
    width: preview?.width ?? positiveDimension(video.width),
    height: preview?.height ?? positiveDimension(video.height),
    externalId: ownerId !== null && videoId !== null ? `${ownerId}_${videoId}` : null,
    title,
    durationSeconds: duration !== null && duration >= 0 ? duration : null
  };
}

export function normalizeVkPost(value: unknown): NormalizedVkPost | null {
  if (!isRecord(value)) return null;
  const postId = integer(value.id);
  const ownerId = integer(value.owner_id);
  const unixDate = integer(value.date);
  if (postId === null || postId <= 0 || ownerId === null || ownerId === 0 || unixDate === null || unixDate <= 0) {
    return null;
  }

  const text = typeof value.text === "string" ? value.text.trim() : "";
  const media: VkMedia[] = [];
  if (Array.isArray(value.attachments)) {
    for (const attachment of value.attachments) {
      const photo = normalizePhotoAttachment(attachment);
      if (photo) {
        media.push(photo);
        continue;
      }
      const video = normalizeVideoAttachment(attachment);
      if (video) media.push(video);
    }
  }

  // copy_history is intentionally not traversed. Reposts without original
  // top-level text/supported media are skipped to avoid importing the same origin from
  // several community walls.
  if (!text && media.length === 0) return null;

  return {
    externalId: String(postId),
    ownerId: String(ownerId),
    sourceUrl: buildVkPostUrl(ownerId, postId),
    text,
    publishedAt: new Date(unixDate * 1000).toISOString(),
    media,
    rawPayload: value
  };
}

export function isFreshVkPost(
  post: Pick<NormalizedVkPost, "publishedAt">,
  now = Date.now(),
  freshnessMs = vkImportFreshnessMs
) {
  const publishedAt = Date.parse(post.publishedAt);
  return Number.isFinite(publishedAt) && publishedAt + freshnessMs > now;
}

export function filterFreshVkPosts(
  posts: NormalizedVkPost[],
  now = Date.now(),
  freshnessMs = vkImportFreshnessMs
) {
  return posts.filter((post) => isFreshVkPost(post, now, freshnessMs));
}

export function normalizeVkWallResponse(value: unknown) {
  if (!isRecord(value)) throw new VkApiError("VK returned an invalid response");
  if (isRecord(value.error)) {
    const code = integer(value.error.error_code);
    const message = typeof value.error.error_msg === "string"
      ? value.error.error_msg.trim().slice(0, 300)
      : "Unknown VK API error";
    throw new VkApiError(`VK API error${code === null ? "" : ` ${code}`}: ${message}`, code);
  }
  if (!isRecord(value.response) || !Array.isArray(value.response.items)) {
    throw new VkApiError("VK returned an invalid wall.get payload");
  }

  const byExternalId = new Map<string, NormalizedVkPost>();
  for (const item of value.response.items) {
    const post = normalizeVkPost(item);
    if (post && !byExternalId.has(post.externalId)) byExternalId.set(post.externalId, post);
  }
  return Array.from(byExternalId.values());
}

export async function fetchVkWall({
  domain,
  accessToken,
  count = 20,
  fetchImpl = fetch
}: {
  domain: string;
  accessToken: string;
  count?: number;
  fetchImpl?: FetchLike;
}) {
  const url = new URL("https://api.vk.com/method/wall.get");
  url.searchParams.set("domain", domain);
  url.searchParams.set("count", String(Math.max(1, Math.min(100, Math.trunc(count)))));
  url.searchParams.set("filter", "owner");
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("v", "5.199");

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new VkApiError("VK request failed");
  }
  if (!response.ok) throw new VkApiError(`VK HTTP request failed with status ${response.status}`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new VkApiError("VK returned invalid JSON");
  }
  return normalizeVkWallResponse(payload);
}

export function safeVkImportError(error: unknown) {
  if (error instanceof VkApiError) return error.message.slice(0, 1000);
  if (error instanceof Error && /^(Failed|VK|External source)/.test(error.message)) {
    return error.message.slice(0, 1000);
  }
  return "VK source import failed";
}

export async function runVkSourceImports({
  sources,
  fetchPosts,
  persistPosts,
  markSucceeded,
  markFailed
}: {
  sources: VkExternalSource[];
  fetchPosts: (source: VkExternalSource) => Promise<NormalizedVkPost[]>;
  persistPosts: (source: VkExternalSource, posts: NormalizedVkPost[]) => Promise<VkPersistPostsResult>;
  markSucceeded: (source: VkExternalSource, ownerId: string | null) => Promise<void>;
  markFailed: (source: VkExternalSource, error: string) => Promise<void>;
}): Promise<VkImportSummary> {
  const results: VkSourceImportResult[] = [];

  for (const source of sources) {
    try {
      const posts = await fetchPosts(source);
      const ownerIds = Array.from(new Set(posts.map((post) => post.ownerId)));
      if (ownerIds.length > 1) throw new Error("External source returned posts from several VK owners");
      const ownerId = ownerIds[0] ?? source.externalId;
      if (source.externalId && ownerId && source.externalId !== ownerId) {
        throw new Error("External source VK owner does not match the stored identifier");
      }
      const persisted = await persistPosts(source, posts);
      await markSucceeded(source, ownerId);
      results.push({
        sourceId: source.id,
        status: "succeeded",
        discoveredCount: posts.length,
        insertedCount: persisted.insertedCount,
        savedMediaCount: persisted.savedMediaCount,
        failedMediaCount: persisted.failedMediaCount,
        error: null
      });
    } catch (error) {
      const message = safeVkImportError(error);
      try {
        await markFailed(source, message);
      } catch {
        // A diagnostics update must not stop the remaining communities.
      }
      results.push({
        sourceId: source.id,
        status: "failed",
        discoveredCount: 0,
        insertedCount: 0,
        savedMediaCount: 0,
        failedMediaCount: 0,
        error: message
      });
    }
  }

  return {
    sourceCount: sources.length,
    succeededCount: results.filter((result) => result.status === "succeeded").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    discoveredCount: results.reduce((total, result) => total + result.discoveredCount, 0),
    insertedCount: results.reduce((total, result) => total + result.insertedCount, 0),
    savedMediaCount: results.reduce((total, result) => total + result.savedMediaCount, 0),
    failedMediaCount: results.reduce((total, result) => total + result.failedMediaCount, 0),
    results
  };
}
