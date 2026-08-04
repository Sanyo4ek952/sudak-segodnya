import { describe, expect, it } from "vitest";
import {
  hasExplicitCancellationEvidence,
  isCandidateStale,
  selectOrganizationEvidence
} from "@/features/content-ingestion/model/candidate-rules";
import type { PublicationCandidatePayload } from "@/features/content-ingestion/model/contracts";

const publication: PublicationCandidatePayload = {
  kind: "publication",
  organizationId: null,
  organizationName: "Организация",
  targetPublicationId: null,
  type: "promo",
  title: "Акция",
  description: null,
  categorySlug: "services",
  startsAt: null,
  endsAt: null,
  validUntil: "2026-08-10T23:59:59+03:00",
  place: null,
  priceText: null,
  isFree: false,
  ageLimit: null,
  contactPhone: null,
  scheduleEntries: [],
  imageSourceUrl: null
};

describe("candidate business rules", () => {
  it("marks expired facts stale without guessing a missing date", () => {
    expect(isCandidateStale(publication, new Date("2026-08-11T00:00:00+03:00"))).toBe(true);
    expect(isCandidateStale({ ...publication, validUntil: null }, new Date("2026-08-11T00:00:00+03:00"))).toBe(false);
  });

  it("requires an explicit cancellation phrase", () => {
    expect(hasExplicitCancellationEvidence([
      { field: "status", excerpt: "Мероприятие отменено организатором", sourceUrl: "https://example.com/event" }
    ])).toBe(true);
    expect(hasExplicitCancellationEvidence([
      { field: "status", excerpt: "Расписание может измениться", sourceUrl: "https://example.com/event" }
    ])).toBe(false);
  });

  it("uses verified publication evidence when an organization-specific field is unavailable", () => {
    const evidence = [
      { field: "title", excerpt: "Official source title", sourceUrl: "https://example.com/event" },
      { field: "description", excerpt: "Official source description", sourceUrl: "https://example.com/event" }
    ];
    expect(selectOrganizationEvidence(evidence)).toEqual(evidence);
  });

  it("prefers organization-specific evidence when it is available", () => {
    expect(selectOrganizationEvidence([
      { field: "title", excerpt: "Event title", sourceUrl: "https://example.com/event" },
      { field: "organizationName", excerpt: "Official organization", sourceUrl: "https://example.com/event" }
    ])).toEqual([
      { field: "organizationName", excerpt: "Official organization", sourceUrl: "https://example.com/event" }
    ]);
  });
});
