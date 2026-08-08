"use client";

import { ErrorState } from "@/shared/ui/error-state";

export default function AdminVkError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-form">
      <ErrorState
        title="Не удалось загрузить импорт VK"
        description="Очередь и источники не изменены. Попробуйте загрузить раздел повторно."
        onRetry={reset}
      />
    </div>
  );
}
