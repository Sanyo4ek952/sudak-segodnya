import type {
  ContentCandidateEvidence,
  ContentCandidatePayload
} from "@/features/content-ingestion/model/contracts";

export function isCandidateStale(payload: ContentCandidatePayload, now = new Date()) {
  if (payload.kind !== "publication") return false;
  const cutoff = payload.type === "event"
    ? payload.endsAt ?? payload.startsAt
    : payload.validUntil;
  return Boolean(cutoff && Date.parse(cutoff) <= now.getTime());
}

export function hasExplicitCancellationEvidence(evidence: ContentCandidateEvidence[]) {
  return evidence.some((item) => /отмен|не состо|перенесен|перенесён/i.test(item.excerpt));
}
