"use client";

import { useEffect, useRef } from "react";
import { trackAnalyticsEvent, type AnalyticsEventInput } from "@/features/analytics/model/events";

type AnalyticsOnViewProps = {
  analytics: AnalyticsEventInput;
};

export function AnalyticsOnView({ analytics }: AnalyticsOnViewProps) {
  const elementRef = useRef<HTMLSpanElement | null>(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;

    if (!element || trackedRef.current) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      trackedRef.current = true;
      trackAnalyticsEvent(analytics);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !trackedRef.current) {
          trackedRef.current = true;
          trackAnalyticsEvent(analytics);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [analytics]);

  return <span ref={elementRef} aria-hidden="true" className="sr-only" />;
}
