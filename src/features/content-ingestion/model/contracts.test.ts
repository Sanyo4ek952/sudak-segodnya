import { describe, expect, it } from "vitest";
import {
  contentCandidatePayloadSchema,
  extractedCandidateSchema,
  getCandidatePublishWarnings,
  manualIngestionRequestSchema
} from "@/features/content-ingestion/model/contracts";
import { createContentFingerprint } from "@/features/content-ingestion/model/fingerprint";

const eventPayload = {
  kind: "publication" as const,
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationName: "Судакский музей",
  targetPublicationId: null,
  type: "event" as const,
  title: "Лекция об истории Судака",
  description: "Открытая лекция для жителей и гостей города.",
  categorySlug: "culture",
  startsAt: "2026-08-14T12:00:00+03:00",
  endsAt: "2026-08-14T14:00:00+03:00",
  validUntil: null,
  place: "Судакская крепость",
  priceText: "Бесплатно",
  isFree: true,
  ageLimit: "12+",
  contactPhone: null,
  scheduleEntries: [],
  imageSourceUrl: "https://museum.example.org/images/lecture.jpg"
};

describe("content ingestion contracts", () => {
  it("accepts a complete event and has no publish warnings", () => {
    const parsed = contentCandidatePayloadSchema.parse(eventPayload);
    expect(getCandidatePublishWarnings(parsed, new Date("2026-08-04T00:00:00+03:00"))).toEqual([]);
  });

  it("accepts PostgreSQL UUID values that are not RFC versioned", () => {
    expect(contentCandidatePayloadSchema.safeParse({
      ...eventPayload,
      organizationId: "10000000-0000-0000-0000-000000000001"
    }).success).toBe(true);
    expect(manualIngestionRequestSchema.safeParse({
      sourceId: "60000000-0000-0000-0000-000000000001"
    }).success).toBe(true);
  });

  it("blocks publishing when facts are incomplete instead of inventing them", () => {
    const parsed = contentCandidatePayloadSchema.parse({
      ...eventPayload,
      endsAt: null,
      priceText: null,
      isFree: false
    });
    expect(getCandidatePublishWarnings(parsed, new Date("2026-08-04T00:00:00+03:00"))).toEqual(
      expect.arrayContaining([
        "Для мероприятия нужны начало и окончание.",
        "Укажите цену или отметьте бесплатное участие."
      ])
    );
  });

  it("warns when the official source has no image", () => {
    const parsed = contentCandidatePayloadSchema.parse({ ...eventPayload, imageSourceUrl: null });
    expect(getCandidatePublishWarnings(parsed)).toContain(
      "Источник не предоставил изображение; будет использована нейтральная заглушка."
    );
  });

  it("allows the server to resolve a target publication for update and cancellation", () => {
    const result = extractedCandidateSchema.safeParse({
      action: "cancel_publication",
      externalId: "event-1",
      payload: eventPayload,
      evidence: [{ field: "title", excerpt: "Лекция об истории Судака", sourceUrl: "https://example.com" }],
      warnings: []
    });
    expect(result.success).toBe(true);
  });

  it("requires verified-source evidence and Moscow model timestamps", () => {
    expect(extractedCandidateSchema.safeParse({
      action: "create_publication",
      externalId: "event-2",
      payload: eventPayload,
      evidence: [],
      warnings: []
    }).success).toBe(false);
    expect(extractedCandidateSchema.safeParse({
      action: "create_publication",
      externalId: "event-2",
      payload: { ...eventPayload, startsAt: "2026-08-14T13:00:00+04:00" },
      evidence: [{ field: "startsAt", excerpt: "14 августа", sourceUrl: "https://example.com" }],
      warnings: []
    }).success).toBe(false);
    expect(extractedCandidateSchema.safeParse({
      action: "create_publication",
      externalId: "news-1",
      payload: {
        ...eventPayload,
        type: "news",
        startsAt: null,
        endsAt: null,
        sourcePublishedAt: "2026-08-14T13:00:00+04:00"
      },
      evidence: [{ field: "title", excerpt: "Новость", sourceUrl: "https://example.com" }],
      warnings: []
    }).success).toBe(false);
  });

  it("requires exactly one manual ingestion target", () => {
    expect(manualIngestionRequestSchema.safeParse({}).success).toBe(false);
    expect(manualIngestionRequestSchema.safeParse({ sourceId: crypto.randomUUID(), url: "https://example.com" }).success).toBe(false);
    expect(manualIngestionRequestSchema.safeParse({ url: "https://example.com" }).success).toBe(true);
    expect(manualIngestionRequestSchema.safeParse({ url: "https://example.com", publish: true }).success).toBe(false);
  });

  it("rejects model attempts to inject system fields or unsafe links", () => {
    expect(contentCandidatePayloadSchema.safeParse({ ...eventPayload, status: "published" }).success).toBe(false);
    expect(contentCandidatePayloadSchema.safeParse({ ...eventPayload, imageSourceUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("normalizes visually equivalent fingerprints", () => {
    const left = contentCandidatePayloadSchema.parse(eventPayload);
    const right = contentCandidatePayloadSchema.parse({
      ...eventPayload,
      title: "  ЛЕКЦИЯ   ОБ ИСТОРИИ СУДАКА  ",
      organizationName: "Судакский музей"
    });
    expect(createContentFingerprint(left)).toBe(createContentFingerprint(right));
  });
});
