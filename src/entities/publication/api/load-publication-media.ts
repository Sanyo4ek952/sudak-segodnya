"use client";

import type { PublicationMedia } from "@/entities/publication/model/types";

type Resolver = (media: PublicationMedia[]) => void;
let pending = new Map<string, Resolver[]>();
let scheduled: ReturnType<typeof setTimeout> | null = null;
const cache = new Map<string, PublicationMedia[]>();

async function flush() {
  const batch = pending;
  pending = new Map();
  scheduled = null;
  const ids = Array.from(batch.keys()).slice(0, 50);
  try {
    const response = await fetch(`/api/publications/media?ids=${encodeURIComponent(ids.join(","))}`);
    const payload = response.ok
      ? await response.json() as { mediaByPublication?: Record<string, PublicationMedia[]> }
      : null;
    ids.forEach((id) => {
      const media = payload?.mediaByPublication?.[id]?.slice(0, 10) ?? [];
      cache.set(id, media);
      batch.get(id)?.forEach((resolve) => resolve(media));
    });
  } catch {
    ids.forEach((id) => batch.get(id)?.forEach((resolve) => resolve([])));
  }
  const remaining = Array.from(batch.entries()).slice(50);
  remaining.forEach(([id, resolvers]) => pending.set(id, resolvers));
  if (pending.size) scheduled = setTimeout(flush, 0);
}

export function loadPublicationMedia(publicationId: string) {
  const cached = cache.get(publicationId);
  if (cached) return Promise.resolve(cached);
  return new Promise<PublicationMedia[]>((resolve) => {
    pending.set(publicationId, [...(pending.get(publicationId) ?? []), resolve]);
    if (!scheduled) scheduled = setTimeout(flush, 0);
  });
}
