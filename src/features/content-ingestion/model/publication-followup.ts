import type { ContentCandidateAction } from "@/features/content-ingestion/model/contracts";

export function resolvePublicationFollowup({
  incomingAction,
  previousAction,
  previousPublicationId,
  cancellationConfirmed
}: {
  incomingAction: ContentCandidateAction;
  previousAction: ContentCandidateAction | null;
  previousPublicationId: string | null;
  cancellationConfirmed: boolean;
}) {
  if (incomingAction !== "create_publication" || !previousAction || !previousPublicationId) {
    return {
      action: incomingAction,
      targetPublicationId: null,
      skip: false
    };
  }

  if (previousAction === "cancel_publication") {
    return cancellationConfirmed
      ? { action: "cancel_publication" as const, targetPublicationId: previousPublicationId, skip: true }
      : { action: "create_publication" as const, targetPublicationId: null, skip: false };
  }

  return {
    action: cancellationConfirmed ? "cancel_publication" as const : "update_publication" as const,
    targetPublicationId: previousPublicationId,
    skip: false
  };
}
