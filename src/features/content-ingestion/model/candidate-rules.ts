import type {
  ContentCandidateEvidence,
  ContentCandidatePayload
} from "@/features/content-ingestion/model/contracts";

export const importedNewsFreshnessDays = 7;

const dayInMilliseconds = 24 * 60 * 60 * 1000;

function toMoscowOffsetIso(timestamp: number) {
  const moscow = new Date(timestamp + 3 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${moscow.getUTCFullYear()}-${pad(moscow.getUTCMonth() + 1)}-${pad(moscow.getUTCDate())}`
    + `T${pad(moscow.getUTCHours())}:${pad(moscow.getUTCMinutes())}:${pad(moscow.getUTCSeconds())}+03:00`;
}

export function importedNewsValidUntil(sourcePublishedAt: string) {
  const timestamp = Date.parse(sourcePublishedAt);
  return Number.isNaN(timestamp)
    ? null
    : toMoscowOffsetIso(timestamp + importedNewsFreshnessDays * dayInMilliseconds);
}

export function applyImportedNewsValidity(payload: ContentCandidatePayload): ContentCandidatePayload {
  if (payload.kind !== "publication" || payload.type !== "news" || !payload.sourcePublishedAt) {
    return payload;
  }
  return {
    ...payload,
    validUntil: importedNewsValidUntil(payload.sourcePublishedAt)
  };
}

export function classifyCandidateTemporalState(
  originalPayload: ContentCandidatePayload,
  now = new Date()
) {
  const payload = applyImportedNewsValidity(originalPayload);
  if (payload.kind !== "publication") {
    return { payload, status: "pending" as const, warnings: [] as string[] };
  }

  const warnings = payload.type === "news" && !payload.sourcePublishedAt
    ? ["Дата публикации в первичном источнике не подтверждена. Проверьте её вручную перед публикацией."]
    : [];
  const cutoff = payload.type === "event"
    ? payload.endsAt ?? payload.startsAt
    : payload.validUntil;
  const stale = Boolean(cutoff && Date.parse(cutoff) <= now.getTime());
  return { payload, status: stale ? "stale" as const : "pending" as const, warnings };
}

export function isCandidateStale(payload: ContentCandidatePayload, now = new Date()) {
  return classifyCandidateTemporalState(payload, now).status === "stale";
}

export function hasExplicitCancellationEvidence(evidence: ContentCandidateEvidence[]) {
  return evidence.some((item) => /отмен|не состо|перенесен|перенесён/i.test(item.excerpt));
}

const organizationEvidenceFields = new Set(["organizationName", "place", "contactPhone"]);

export function selectOrganizationEvidence(evidence: ContentCandidateEvidence[]) {
  const organizationEvidence = evidence.filter((item) => organizationEvidenceFields.has(item.field));
  return organizationEvidence.length > 0 ? organizationEvidence : evidence.slice(0, 4);
}
