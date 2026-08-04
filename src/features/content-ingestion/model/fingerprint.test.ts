import { describe, expect, it } from "vitest";
import {
  createContentFingerprint,
  createContentHash
} from "@/features/content-ingestion/model/fingerprint";
import type { PublicationCandidatePayload } from "@/features/content-ingestion/model/contracts";

const base: PublicationCandidatePayload = {
  kind: "publication",
  organizationId: null,
  organizationName: "Музей-заповедник «Судакская крепость»",
  targetPublicationId: null,
  type: "event",
  title: "Лекция об истории Судака",
  description: "Фактическое описание",
  categorySlug: "culture",
  startsAt: "2026-08-14T10:15:00+03:00",
  endsAt: null,
  validUntil: null,
  place: "Судакская крепость",
  priceText: "Бесплатно",
  isFree: true,
  ageLimit: "12+",
  contactPhone: null,
  scheduleEntries: [],
  imageSourceUrl: null
};

describe("content candidate fingerprints", () => {
  it("normalizes case, whitespace and ё for cross-source duplicates", () => {
    const variant = {
      ...base,
      organizationName: "  МУЗЕЙ-ЗАПОВЕДНИК  «СУДАКСКАЯ КРЕПОСТЬ» ",
      title: "Лекция   об истории Судака"
    };
    expect(createContentFingerprint(variant)).toBe(createContentFingerprint(base));
  });

  it("changes when the event date changes", () => {
    expect(createContentFingerprint({ ...base, startsAt: "2026-08-15T10:15:00+03:00" }))
      .not.toBe(createContentFingerprint(base));
  });

  it("creates stable content versions", () => {
    expect(createContentHash(base)).toBe(createContentHash({ ...base }));
  });
});
