export const maxVkImportedImageBytes = 5 * 1024 * 1024;

const allowedVkMediaHostSuffixes = [
  "userapi.com",
  "vkuserphoto.ru",
  "vk-cdn.net",
  "vk.com",
  "vk.ru"
];

const allowedVkMediaHosts = new Set([
  "iv.okcdn.ru"
]);

const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

type VkImportedImageMimeType = keyof typeof imageExtensions;
type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

function mediaUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("VK media URL is invalid");
  }

  const hostname = parsed.hostname.toLocaleLowerCase("en-US").replace(/\.$/, "");
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || (
      !allowedVkMediaHosts.has(hostname)
      && !allowedVkMediaHostSuffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))
    )
  ) {
    throw new Error("VK media URL is not allowed");
  }
  return parsed;
}

function detectedMimeType(bytes: Uint8Array): VkImportedImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8
    && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value)
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12
    && new TextDecoder("ascii").decode(bytes.subarray(0, 4)) === "RIFF"
    && new TextDecoder("ascii").decode(bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function validateVkMediaImage(
  bytes: Uint8Array,
  declaredContentType: string,
  maximumBytes = maxVkImportedImageBytes
) {
  if (bytes.length === 0) throw new Error("VK returned an empty media file");
  if (bytes.length > maximumBytes) throw new Error("VK media file exceeds 5 MB");

  const mimeType = declaredContentType
    .split(";", 1)[0]
    .trim()
    .toLocaleLowerCase("en-US") as VkImportedImageMimeType;
  if (!(mimeType in imageExtensions)) throw new Error("VK media type is not supported");
  if (detectedMimeType(bytes) !== mimeType) throw new Error("VK media signature does not match its MIME type");

  const digestInput = Uint8Array.from(bytes).buffer;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput));
  const contentHash = Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
  return {
    bytes,
    contentHash,
    mimeType,
    extension: imageExtensions[mimeType],
    sizeBytes: bytes.length
  };
}

async function readLimitedBody(response: Response) {
  if (!response.body) throw new Error("VK media response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxVkImportedImageBytes) {
      await reader.cancel();
      throw new Error("VK media file exceeds 5 MB");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export async function fetchVkMediaImage({
  sourceUrl,
  fetchImpl = fetch,
  timeoutMs = 15_000,
  maxRedirects = 3
}: {
  sourceUrl: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxRedirects?: number;
}) {
  let current = mediaUrl(sourceUrl);
  const visited = new Set<string>();

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    if (visited.has(current.toString())) throw new Error("VK media redirect loop detected");
    visited.add(current.toString());
    const response = await fetchImpl(current, {
      method: "GET",
      headers: {
        Accept: "image/jpeg, image/png, image/webp",
        "Accept-Encoding": "identity"
      },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs)
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === maxRedirects) throw new Error("VK media redirect is invalid");
      current = mediaUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`VK media request failed with status ${response.status}`);

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxVkImportedImageBytes) {
      throw new Error("VK media file exceeds 5 MB");
    }

    const image = await validateVkMediaImage(
      await readLimitedBody(response),
      response.headers.get("content-type") ?? ""
    );
    return { ...image, finalUrl: current.toString() };
  }

  throw new Error("VK media redirect limit exceeded");
}
