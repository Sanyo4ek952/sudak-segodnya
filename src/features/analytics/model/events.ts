"use client";

import { createSupabaseBrowserClient } from "@/shared/api/supabase/browser";

export const analyticsEventNames = [
  "organization_view",
  "organization_click",
  "publication_view",
  "phone_click",
  "route_click",
  "menu_open",
  "favorite_add",
  "share",
  "calendar"
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsEventInput = {
  eventName: AnalyticsEventName;
  organizationId?: string | null;
  publicationId?: string | null;
  menuItemId?: string | null;
};

const anonymousIdStorageKey = "sudak-today:analytics-anonymous-id";

function getAnonymousId() {
  try {
    const existing = window.localStorage.getItem(anonymousIdStorageKey);

    if (existing) {
      return existing;
    }

    const nextId = crypto.randomUUID();
    window.localStorage.setItem(anonymousIdStorageKey, nextId);
    return nextId;
  } catch {
    return null;
  }
}

export function trackAnalyticsEvent({
  eventName,
  organizationId,
  publicationId,
  menuItemId
}: AnalyticsEventInput) {
  if (typeof window === "undefined") {
    return;
  }

  const anonymousId = getAnonymousId();
  void (async () => {
    try {
      await createSupabaseBrowserClient().rpc("track_public_analytics_event", {
        p_event_name: eventName,
        p_organization_id: organizationId ?? null,
        p_publication_id: publicationId ?? null,
        p_menu_item_id: menuItemId ?? null,
        p_anonymous_id: anonymousId,
        p_metadata: {}
      });
    } catch {
      // Analytics must never block public UI.
    }
  })();
}
