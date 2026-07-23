"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import {
  trackAnalyticsEvent,
  type AnalyticsEventInput
} from "@/features/analytics/model/events";

type AnalyticsLinkProps = ComponentProps<typeof Link> & {
  analytics: AnalyticsEventInput;
};

export function AnalyticsLink({
  analytics,
  onClick,
  children,
  ...props
}: AnalyticsLinkProps) {
  return (
    <Link
      {...props}
      data-analytics-handled="true"
      onClick={(event) => {
        trackAnalyticsEvent(analytics);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}

