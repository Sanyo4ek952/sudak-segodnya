"use client";

import type { ComponentProps } from "react";
import { LinkButton } from "@/shared/ui/button";
import { trackAnalyticsEvent, type AnalyticsEventInput } from "@/features/analytics/model/events";

type AnalyticsLinkButtonProps = ComponentProps<typeof LinkButton> & {
  analytics: AnalyticsEventInput;
};

export function AnalyticsLinkButton({
  analytics,
  onClick,
  children,
  ...props
}: AnalyticsLinkButtonProps) {
  return (
    <LinkButton
      {...props}
      data-analytics-handled="true"
      onClick={(event) => {
        trackAnalyticsEvent(analytics);
        onClick?.(event);
      }}
    >
      {children}
    </LinkButton>
  );
}
