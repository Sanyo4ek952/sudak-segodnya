import { describe, expect, it } from "vitest";
import {
  applyImportedNewsValidity,
  classifyCandidateTemporalState,
  hasExplicitCancellationEvidence,
  importedNewsValidUntil,
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

  it("derives a stable seven-day window for imported news", () => {
    expect(importedNewsValidUntil("2026-08-04T12:00:00+03:00"))
      .toBe("2026-08-11T12:00:00+03:00");
    expect(applyImportedNewsValidity({
      ...publication,
      type: "news",
      sourcePublishedAt: "2026-08-04T12:00:00+03:00"
    })).toMatchObject({ validUntil: "2026-08-11T12:00:00+03:00" });
  });

  it("classifies ended events and old imported news as stale", () => {
    expect(classifyCandidateTemporalState({
      ...publication,
      type: "event",
      startsAt: "2026-08-08T10:00:00+03:00",
      endsAt: "2026-08-08T12:00:00+03:00",
      validUntil: null
    }, new Date("2026-08-08T12:00:00+03:00")).status).toBe("stale");
    expect(classifyCandidateTemporalState({
      ...publication,
      type: "news",
      sourcePublishedAt: "2026-08-01T09:00:00+03:00"
    }, new Date("2026-08-08T09:00:00+03:00")).status).toBe("stale");
  });

  it("keeps undated news pending with a blocking review warning", () => {
    const result = classifyCandidateTemporalState({
      ...publication,
      type: "news",
      validUntil: null,
      sourcePublishedAt: null
    }, new Date("2026-08-08T09:00:00+03:00"));
    expect(result.status).toBe("pending");
    expect(result.warnings.join(" ")).toMatch(/не подтверждена/i);
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
