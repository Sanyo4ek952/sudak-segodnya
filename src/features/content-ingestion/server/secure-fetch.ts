import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const allowedContentTypes = [
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "application/rss+xml",
  "application/atom+xml",
  "application/json",
  "application/feed+json"
];

const blockedIpv4Addresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, "ipv4");
}
blockedIpv4Addresses.addAddress("168.63.129.16", "ipv4");
const blockedIpv6Addresses = new BlockList();
for (const [network, prefix] of [
  ["::", 3], ["4000::", 2], ["8000::", 1],
  ["2001::", 32], ["2001:2::", 48], ["2001:db8::", 32],
  ["2001:10::", 28], ["2001:20::", 28], ["2002::", 16]
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, "ipv6");
}

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  etag?: string | null;
  lastModified?: string | null;
};

export type SafeFetchResult = {
  status: number;
  finalUrl: string;
  contentType: string;
  body: string;
  text: string;
  etag: string | null;
  lastModified: string | null;
  notModified: boolean;
};

function ipv4FromMappedIpv6(value: string) {
  const normalized = value.toLocaleLowerCase("en-US");
  if (!normalized.startsWith("::ffff:")) return null;
  const suffix = normalized.slice(7);
  if (suffix.includes(".")) return suffix;
  const groups = suffix.split(":");
  if (groups.length !== 2) return null;
  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isBlockedIpAddress(value: string) {
  const normalizedInput = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  if (normalizedInput.includes("%")) return true;
  const version = isIP(normalizedInput);
  if (version === 4) return blockedIpv4Addresses.check(normalizedInput, "ipv4");
  if (version !== 6) return true;

  const normalized = normalizedInput.toLocaleLowerCase("en-US");
  const mappedIpv4 = ipv4FromMappedIpv6(normalized);
  if (mappedIpv4) return blockedIpv4Addresses.check(mappedIpv4, "ipv4");
  return blockedIpv6Addresses.check(normalized, "ipv6");
}

export function normalizeSourceUrl(value: string) {
  if (value.length > 2048) throw new Error("URL источника слишком длинный.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Некорректный URL источника.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Источник должен использовать HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("URL источника не должен содержать учётные данные.");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Нестандартные порты источников запрещены.");
  }
  const hostname = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLocaleLowerCase("en-US");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Локальные адреса запрещены.");
  }
  if (isIP(hostname) && isBlockedIpAddress(hostname)) {
    throw new Error("Приватные и служебные адреса запрещены.");
  }

  url.hash = "";
  return url.toString();
}

export async function resolvePublicAddress(hostname: string, timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("DNS источника не ответил вовремя.")), timeoutMs);
    timer.unref();
  });
  const addresses = await Promise.race([lookup(hostname, { all: true, verbatim: true }), timeout])
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
  if (addresses.length === 0 || addresses.some((item) => isBlockedIpAddress(item.address))) {
    throw new Error("Источник разрешается в приватный или служебный адрес.");
  }
  return selectPublicAddress(addresses);
}

export function selectPublicAddress<T extends { address: string; family: number }>(addresses: T[]) {
  const selected = addresses.find((item) => item.family === 4) ?? addresses[0];
  if (!selected) throw new Error("DNS источника не вернул адрес.");
  return selected;
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function createPinnedLookup(address: { address: string; family: number }) {
  return (
    _hostname: string,
    lookupOptions: unknown,
    callback: (...args: unknown[]) => void
  ) => {
    const wantsAll = Boolean(
      lookupOptions &&
      typeof lookupOptions === "object" &&
      "all" in lookupOptions &&
      lookupOptions.all
    );
    if (wantsAll) {
      callback(null, [{ address: address.address, family: address.family }]);
      return;
    }
    callback(null, address.address, address.family);
  };
}

function requestOnce(
  url: URL,
  address: { address: string; family: number },
  options: Required<Pick<SafeFetchOptions, "timeoutMs" | "maxBytes">> & Pick<SafeFetchOptions, "etag" | "lastModified">
) {
  return new Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  }>((resolve, reject) => {
    const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const botHomepage = publicSiteUrl?.startsWith("https://")
      ? publicSiteUrl.replace(/\/$/, "")
      : "https://sudak-today.vercel.app";
    const headers: Record<string, string> = {
      Accept: "text/html, application/xhtml+xml, application/rss+xml, application/atom+xml, application/xml, application/json;q=0.9, text/xml;q=0.8",
      "User-Agent": `SudakTodayContentBot/1.0 (+${botHomepage})`,
      "Accept-Encoding": "identity"
    };
    if (options.etag) headers["If-None-Match"] = options.etag;
    if (options.lastModified) headers["If-Modified-Since"] = options.lastModified;

    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers,
        servername: url.hostname,
        maxHeaderSize: 32 * 1024,
        rejectUnauthorized: true,
        lookup: createPinnedLookup(address) as never
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentEncoding = headerValue(response.headers["content-encoding"]);
        if (contentEncoding && contentEncoding.toLocaleLowerCase("en-US") !== "identity") {
          response.destroy(new Error("Сжатые ответы источников в первой версии не поддерживаются."));
          return;
        }
        const length = Number(response.headers["content-length"] ?? 0);
        if (Number.isFinite(length) && length > options.maxBytes) {
          response.destroy(new Error("Ответ источника превышает допустимый размер."));
          return;
        }

        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let total = 0;
        response.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > options.maxBytes) {
            response.destroy(new Error("Ответ источника превышает допустимый размер."));
            return;
          }
          chunks.push(Uint8Array.from(chunk));
        });
        response.on("end", () => {
          resolve({
            status,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
        response.on("error", reject);
      }
    );

    const deadline = setTimeout(() => request.destroy(new Error("Источник не ответил вовремя.")), options.timeoutMs);
    deadline.unref();
    request.on("error", reject);
    request.on("close", () => clearTimeout(deadline));
    request.end();
  });
}

export function sanitizeSourceText(value: string, maximum = 60_000) {
  return value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|article|section|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximum);
}

export async function fetchPublicSource(value: string, input: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const options = {
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBytes: input.maxBytes ?? DEFAULT_MAX_BYTES,
    maxRedirects: input.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    etag: input.etag ?? null,
    lastModified: input.lastModified ?? null
  };

  const deadline = Date.now() + options.timeoutMs;
  const visited = new Set<string>();
  let current = new URL(normalizeSourceUrl(value));
  for (let redirect = 0; redirect <= options.maxRedirects; redirect += 1) {
    if (visited.has(current.toString())) throw new Error("Обнаружен цикл перенаправлений источника.");
    visited.add(current.toString());
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Источник не ответил вовремя.");
    const address = await resolvePublicAddress(current.hostname.replace(/^\[|\]$/g, ""), remaining);
    const response = await requestOnce(current, address, {
      timeoutMs: Math.max(1, deadline - Date.now()),
      maxBytes: options.maxBytes,
      etag: redirect === 0 ? options.etag : null,
      lastModified: redirect === 0 ? options.lastModified : null
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = headerValue(response.headers.location);
      if (!location || redirect === options.maxRedirects) {
        throw new Error("Источник вернул недопустимое перенаправление.");
      }
      current = new URL(normalizeSourceUrl(new URL(location, current).toString()));
      continue;
    }
    if (response.status >= 300 && response.status < 400) {
      throw new Error("Источник вернул неподдерживаемое перенаправление.");
    }

    const contentType = (headerValue(response.headers["content-type"]) ?? "")
      .split(";", 1)[0]
      .trim()
      .toLocaleLowerCase("en-US");
    if (response.status === 304) {
      return {
        status: 304,
        finalUrl: current.toString(),
        contentType,
        body: "",
        text: "",
        etag: headerValue(response.headers.etag),
        lastModified: headerValue(response.headers["last-modified"]),
        notModified: true
      };
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Источник вернул HTTP ${response.status}.`);
    }
    if (!allowedContentTypes.includes(contentType)) {
      throw new Error("Источник вернул неподдерживаемый тип содержимого.");
    }

    return {
      status: response.status,
      finalUrl: current.toString(),
      contentType,
      body: response.body,
      text: sanitizeSourceText(response.body),
      etag: headerValue(response.headers.etag),
      lastModified: headerValue(response.headers["last-modified"]),
      notModified: false
    };
  }

  throw new Error("Превышено число перенаправлений источника.");
}
