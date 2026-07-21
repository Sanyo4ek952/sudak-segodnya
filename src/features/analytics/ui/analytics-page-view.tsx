"use client";

import { useEffect } from "react";
import { trackAnalyticsEvent, type AnalyticsEventInput } from "@/features/analytics/model/events";

type AnalyticsPageViewProps = {
  analytics: AnalyticsEventInput;
};

export function AnalyticsPageView({ analytics }: AnalyticsPageViewProps) {
  useEffect(() => {
    trackAnalyticsEvent(analytics);
  }, [analytics]);

  return null;
}
