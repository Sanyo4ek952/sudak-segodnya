"use client";

import { createSupabaseBrowserClient } from "@/shared/api/supabase/browser";
import type { TablesInsert } from "@/shared/api/supabase/database.types";

export const analyticsEventNames = [
  "organization_view",
  "publication_view",
  "phone_click",
  "route_click",
  "menu_open",
  "favorite_add"
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
  const payload: TablesInsert<"analytics_events"> = {
    event_name: eventName,
    organization_id: organizationId ?? null,
    publication_id: publicationId ?? null,
    menu_item_id: menuItemId ?? null,
    anonymous_id: anonymousId,
    metadata: {}
  };

  void (async () => {
    try {
      await createSupabaseBrowserClient().from("analytics_events").insert(payload);
    } catch {
      // Analytics must never block public UI.
    }
  })();
}
