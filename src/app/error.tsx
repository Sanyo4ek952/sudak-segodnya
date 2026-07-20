"use client";

import { ErrorState } from "@/shared/ui/error-state";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-form">
      <ErrorState onRetry={reset} />
    </div>
  );
}
