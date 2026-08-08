import { describe, expect, it } from "vitest";
import type { PublicationCandidatePayload } from "@/features/content-ingestion/model/contracts";
import {
  normalizePublicationCandidateForType,
  validateCandidateForIntent
} from "@/features/content-ingestion/model/candidate-form";

const base: PublicationCandidatePayload = {
  kind: "publication",
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationName: "Организация",
  targetPublicationId: null,
  type: "event",
  title: "Мероприятие",
  description: "Подробное описание мероприятия",
  categorySlug: "culture",
  startsAt: "2026-09-01T18:00:00+03:00",
  endsAt: "2026-09-01T20:00:00+03:00",
  validUntil: null,
  place: "Набережная",
  priceText: null,
  isFree: true,
  ageLimit: "6+",
  contactPhone: "+7 978 000-00-00",
  scheduleEntries: [],
  imageSourceUrl: null
};

describe("content candidate form rules", () => {
  it("removes fields that are irrelevant for organization news", () => {
    const normalized = normalizePublicationCandidateForType({
      ...base,
      type: "news",
      validUntil: "2026-09-10T23:59:00+03:00",
      sourcePublishedAt: "2026-09-01T12:00:00+03:00"
    });

    expect(normalized.startsAt).toBeNull();
    expect(normalized.endsAt).toBeNull();
    expect(normalized.place).toBeNull();
    expect(normalized.priceText).toBeNull();
    expect(normalized.contactPhone).toBeNull();
    expect(normalized.validUntil).toBe("2026-09-08T12:00:00+03:00");
  });

  it("blocks publishing news without a reliable source date", () => {
    const errors = validateCandidateForIntent({
      payload: normalizePublicationCandidateForType({
        ...base,
        type: "news",
        validUntil: null,
        sourcePublishedAt: null
      }),
      action: "create_publication",
      intent: "approve_publish",
      now: new Date("2026-08-08T12:00:00+03:00")
    });
    expect(errors.sourcePublishedAt).toMatch(/источник/i);
  });

  it("allows incomplete data to be saved without publishing it", () => {
    const errors = validateCandidateForIntent({
      payload: { ...base, organizationId: null, description: null, endsAt: null },
      action: "create_publication",
      intent: "save_changes"
    });
    expect(errors).toEqual({});
  });

  it("returns field-level Russian errors before publication", () => {
    const errors = validateCandidateForIntent({
      payload: {
        ...base,
        organizationId: null,
        description: "Коротко",
        startsAt: "2026-08-01T18:00:00+03:00",
        endsAt: "2026-08-01T20:00:00+03:00",
        place: null,
        isFree: false
      },
      action: "create_publication",
      intent: "approve_publish",
      now: new Date("2026-08-08T12:00:00+03:00")
    });

    expect(errors.organizationId).toMatch(/организац/i);
    expect(errors.description).toMatch(/10 символов/i);
    expect(errors.endsAt).toMatch(/завершившееся/i);
    expect(errors.place).toMatch(/место/i);
    expect(errors.priceText).toMatch(/цену/i);
  });
});
