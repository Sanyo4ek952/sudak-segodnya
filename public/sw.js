const VERSION = "2026-07-20-1";
const STATIC_CACHE = `sudak-today-static-${VERSION}`;
const PAGE_CACHE = `sudak-today-pages-${VERSION}`;
const ALLOWED_CACHES = new Set([STATIC_CACHE, PAGE_CACHE]);

const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [
  OFFLINE_URL,
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-icon-192.png",
  "/icons/maskable-icon-512.png"
];

const NEVER_CACHE_PREFIXES = [
  "/admin",
  "/business",
  "/auth",
  "/api",
  "/_next/data"
];

const NEVER_CACHE_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/weather"
]);

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isSupabaseRequest(url) {
  return /\.supabase\.co$/i.test(url.hostname) || url.hostname.includes(".supabase.co");
}

function isNeverCachePath(pathname) {
  return NEVER_CACHE_PATHS.has(pathname) || NEVER_CACHE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasPrivateRequestSignals(request) {
  return request.method !== "GET" || request.headers.has("authorization") || request.headers.has("cookie");
}

function hasPrivateResponseSignals(response) {
  const cacheControl = response.headers.get("cache-control") || "";

  return (
    response.headers.has("set-cookie") ||
    /\bno-store\b/i.test(cacheControl) ||
    /\bprivate\b/i.test(cacheControl)
  );
}

function isStaticAsset(url) {
  return (
    isSameOrigin(url) &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/apple-touch-icon.png" ||
      url.pathname.startsWith("/icons/"))
  );
}

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isPublicNavigation(request, url) {
  return isSameOrigin(url) && isNavigationRequest(request) && !isNeverCachePath(url.pathname);
}

async function cacheStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok && !hasPrivateResponseSignals(response)) {
    await cache.put(request, response.clone());
  }

  return response;
}

async function cachePublicNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok && response.type === "basic" && !hasPrivateResponseSignals(response)) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => (ALLOWED_CACHES.has(cacheName) ? undefined : caches.delete(cacheName)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (hasPrivateRequestSignals(request) || isSupabaseRequest(url) || !isSameOrigin(url) || isNeverCachePath(url.pathname)) {
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheStaticAsset(request));
    return;
  }

  if (isPublicNavigation(request, url)) {
    event.respondWith(cachePublicNavigation(request));
  }
});
