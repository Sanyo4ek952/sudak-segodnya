"use client";

import { useActionState } from "react";
import { retryCandidateImageAction } from "@/features/content-ingestion/model/actions";
import { initialContentIngestionActionState } from "@/features/content-ingestion/model/types";
import { ContentIngestionActionMessage } from "@/features/content-ingestion/ui/content-ingestion-action-message";
import { SubmitButton } from "@/shared/ui/submit-button";

export function CandidateImageRetryForm({ candidateId }: { candidateId: string }) {
  const [state, action] = useActionState(
    retryCandidateImageAction,
    initialContentIngestionActionState
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="candidateId" value={candidateId} />
      <SubmitButton variant="outline" pendingLabel="Импортируем…">
        Повторить импорт изображения
      </SubmitButton>
      <ContentIngestionActionMessage state={state} />
    </form>
  );
}
