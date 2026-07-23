"use client";

import { useEffect } from "react";
import {
  trackAnalyticsEvent,
  type AnalyticsEventInput,
  type AnalyticsEventName
} from "@/features/analytics/model/events";

type AnalyticsActionListenerProps = {
  context: Omit<AnalyticsEventInput, "eventName">;
};

function getEventName(href: string): AnalyticsEventName | null {
  if (href.startsWith("tel:")) {
    return "phone_click";
  }

  if (href.includes("yandex.ru/maps")) {
    return "route_click";
  }

  try {
    if (new URL(href, window.location.origin).pathname.startsWith("/organizations/")) {
      return "organization_click";
    }
  } catch {
    return null;
  }

  return null;
}

export function AnalyticsActionListener({ context }: AnalyticsActionListenerProps) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a[href]");

      if (!(link instanceof HTMLAnchorElement) || link.dataset.analyticsHandled === "true") {
        return;
      }

      const eventName = getEventName(link.href);

      if (!eventName) {
        return;
      }

      trackAnalyticsEvent({ eventName, ...context });
    };

    document.addEventListener("click", handleClick, { capture: true });

    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [context]);

  return null;
}
