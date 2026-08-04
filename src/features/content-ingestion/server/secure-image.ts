import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import {
  createPinnedLookup,
  normalizeSourceUrl,
  resolvePublicAddress
} from "@/features/content-ingestion/server/secure-fetch";

export const MAX_IMPORTED_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 3;

const imageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

export type ImportedImageMimeType = keyof typeof imageExtensions;

export type ValidatedImage = {
  bytes: Buffer;
  contentHash: string;
  mimeType: ImportedImageMimeType;
  extension: (typeof imageExtensions)[ImportedImageMimeType];
  sizeBytes: number;
};

function detectedMimeType(bytes: Buffer): ImportedImageMimeType | null {
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
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validateImageFile(
  bytes: Buffer,
  declaredContentType: string,
  maximumBytes = MAX_IMPORTED_IMAGE_BYTES
): ValidatedImage {
  if (bytes.length === 0) throw new Error("Источник вернул пустой файл изображения.");
  if (bytes.length > maximumBytes) throw new Error("Изображение превышает допустимый размер 5 МБ.");

  const mimeType = declaredContentType
    .split(";", 1)[0]
    .trim()
    .toLocaleLowerCase("en-US") as ImportedImageMimeType;
  if (!(mimeType in imageExtensions)) {
    throw new Error("Разрешены только изображения JPEG, PNG и WebP.");
  }

  const detected = detectedMimeType(bytes);
  if (!detected || detected !== mimeType) {
    throw new Error("Сигнатура файла не соответствует заявленному MIME-типу изображения.");
  }

  return {
    bytes,
    contentHash: createHash("sha256").update(Uint8Array.from(bytes)).digest("hex"),
    mimeType,
    extension: imageExtensions[mimeType],
    sizeBytes: bytes.length
  };
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function requestImageOnce(
  url: URL,
  address: { address: string; family: number },
  timeoutMs: number
) {
  return new Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    bytes: Buffer;
  }>((resolve, reject) => {
    const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const botHomepage = publicSiteUrl?.startsWith("https://")
      ? publicSiteUrl.replace(/\/$/, "")
      : "https://sudak-today.vercel.app";
    const request = httpsRequest(url, {
      method: "GET",
      headers: {
        Accept: "image/jpeg, image/png, image/webp",
        "Accept-Encoding": "identity",
        "User-Agent": `SudakTodayContentBot/1.0 (+${botHomepage})`
      },
      servername: url.hostname,
      maxHeaderSize: 32 * 1024,
      rejectUnauthorized: true,
      lookup: createPinnedLookup(address) as never
    }, (response) => {
      const contentEncoding = headerValue(response.headers["content-encoding"]);
      if (contentEncoding && contentEncoding.toLocaleLowerCase("en-US") !== "identity") {
        response.destroy(new Error("Сжатые ответы для изображений не поддерживаются."));
        return;
      }
      const contentLength = Number(response.headers["content-length"] ?? 0);
      if (Number.isFinite(contentLength) && contentLength > MAX_IMPORTED_IMAGE_BYTES) {
        response.destroy(new Error("Изображение превышает допустимый размер 5 МБ."));
        return;
      }

      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_IMPORTED_IMAGE_BYTES) {
          response.destroy(new Error("Изображение превышает допустимый размер 5 МБ."));
          return;
        }
        chunks.push(Uint8Array.from(chunk));
      });
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        bytes: Buffer.concat(chunks)
      }));
      response.on("error", reject);
    });

    const deadline = setTimeout(
      () => request.destroy(new Error("Сервер изображения не ответил вовремя.")),
      timeoutMs
    );
    deadline.unref();
    request.on("error", reject);
    request.on("close", () => clearTimeout(deadline));
    request.end();
  });
}

export async function fetchValidatedImage(value: string): Promise<ValidatedImage & { finalUrl: string }> {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  const visited = new Set<string>();
  let current = new URL(normalizeSourceUrl(value));

  for (let redirect = 0; redirect <= DEFAULT_MAX_REDIRECTS; redirect += 1) {
    if (visited.has(current.toString())) throw new Error("Обнаружен цикл перенаправлений изображения.");
    visited.add(current.toString());
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Сервер изображения не ответил вовремя.");
    const address = await resolvePublicAddress(current.hostname.replace(/^\[|\]$/g, ""), remaining);
    const response = await requestImageOnce(current, address, Math.max(1, deadline - Date.now()));

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = headerValue(response.headers.location);
      if (!location || redirect === DEFAULT_MAX_REDIRECTS) {
        throw new Error("Сервер изображения вернул недопустимое перенаправление.");
      }
      current = new URL(normalizeSourceUrl(new URL(location, current).toString()));
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Сервер изображения вернул HTTP ${response.status}.`);
    }

    const validated = validateImageFile(
      response.bytes,
      headerValue(response.headers["content-type"]) ?? ""
    );
    return { ...validated, finalUrl: current.toString() };
  }

  throw new Error("Превышено число перенаправлений изображения.");
}
