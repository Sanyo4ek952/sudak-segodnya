import { createHash } from "node:crypto";
import type { ContentCandidatePayload } from "@/features/content-ingestion/model/contracts";

function normalizePart(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createContentFingerprint(payload: ContentCandidatePayload) {
  if (payload.kind === "organization") {
    return sha256([
      "organization",
      normalizePart(payload.name),
      normalizePart(payload.phone),
      normalizePart(payload.address)
    ].join("|"));
  }

  const temporalKey = payload.startsAt ?? payload.validUntil ?? "";
  return sha256([
    "publication",
    payload.type,
    normalizePart(payload.organizationName),
    normalizePart(payload.title),
    normalizePart(temporalKey),
    normalizePart(payload.place)
  ].join("|"));
}

export function createContentHash(value: unknown) {
  return sha256(JSON.stringify(value));
}
