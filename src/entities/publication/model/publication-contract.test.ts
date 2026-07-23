import { describe, expect, it } from "vitest";
import { createPublicationInputSchema, type SavePublicationInput } from "./publication-contract";

const now = new Date("2026-07-23T09:00:00.000Z");
const schema = createPublicationInputSchema(now);

const validEvent: SavePublicationInput = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  publicationId: "",
  clientRequestId: "00000000-0000-4000-8000-000000000002",
  intent: "publish",
  type: "event",
  title: "Городской концерт",
  description: "Большой концерт на городской набережной.",
  categoryId: "00000000-0000-4000-8000-000000000003",
  startsAt: "2026-07-24T16:00:00.000Z",
  endsAt: "2026-07-24T18:00:00.000Z",
  validUntil: "",
  publishAt: "",
  place: "Городская набережная",
  priceText: "500 ₽",
  isFree: false,
  ageLimit: "6+",
  contactPhone: "+7 900 000-00-00",
  scheduleEntries: []
};

describe("publication input contract", () => {
  it("accepts a complete event", () => {
    expect(schema.safeParse(validEvent).success).toBe(true);
  });

  it("allows an incomplete draft", () => {
    expect(
      schema.safeParse({
        ...validEvent,
        intent: "draft",
        description: "",
        startsAt: "",
        endsAt: "",
        place: "",
        priceText: ""
      }).success
    ).toBe(true);
  });

  it("rejects an event without its end", () => {
    expect(schema.safeParse({ ...validEvent, endsAt: "" }).success).toBe(false);
  });

  it("rejects an event with reversed times", () => {
    expect(
      schema.safeParse({
        ...validEvent,
        startsAt: "2026-07-24T18:00:00.000Z",
        endsAt: "2026-07-24T16:00:00.000Z"
      }).success
    ).toBe(false);
  });

  it("rejects a paid event without a price", () => {
    expect(schema.safeParse({ ...validEvent, priceText: "" }).success).toBe(false);
  });

  it("accepts a free event without a price", () => {
    expect(schema.safeParse({ ...validEvent, isFree: true, priceText: "" }).success).toBe(true);
  });

  it("rejects a news item without validUntil", () => {
    expect(
      schema.safeParse({
        ...validEvent,
        type: "news",
        startsAt: "",
        endsAt: "",
        place: "",
        validUntil: ""
      }).success
    ).toBe(false);
  });

  it("rejects an expired non-event publication", () => {
    expect(
      schema.safeParse({
        ...validEvent,
        type: "announcement",
        startsAt: "",
        endsAt: "",
        place: "",
        validUntil: "2026-07-22T18:00:00.000Z"
      }).success
    ).toBe(false);
  });

  it("requires a structured schedule for a regular activity", () => {
    expect(
      schema.safeParse({
        ...validEvent,
        type: "regular",
        startsAt: "",
        endsAt: "",
        validUntil: "2026-08-30T18:00:00.000Z",
        scheduleEntries: []
      }).success
    ).toBe(false);
  });

  it("accepts a regular activity with a structured schedule", () => {
    expect(
      schema.safeParse({
        ...validEvent,
        type: "regular",
        startsAt: "",
        endsAt: "",
        validUntil: "2026-08-30T18:00:00.000Z",
        scheduleEntries: [
          {
            scheduleText: "По понедельникам, 18:00–19:30",
            weekday: 1,
            startsAt: "18:00",
            endsAt: "19:30",
            sortOrder: 0,
            timezone: "Europe/Moscow"
          }
        ]
      }).success
    ).toBe(true);
  });

  it("rejects a free-text-only regular schedule", () => {
    expect(
      schema.safeParse({
        ...validEvent,
        type: "regular",
        startsAt: "",
        endsAt: "",
        validUntil: "2026-08-30T18:00:00.000Z",
        scheduleEntries: [
          {
            scheduleText: "По будням вечером",
            weekday: null,
            startsAt: null,
            endsAt: null,
            sortOrder: 0,
            timezone: "Europe/Moscow"
          }
        ]
      }).success
    ).toBe(false);
  });

  it("requires a future publishAt for scheduling", () => {
    expect(
      schema.safeParse({
        ...validEvent,
        intent: "schedule",
        publishAt: "2026-07-22T18:00:00.000Z"
      }).success
    ).toBe(false);
  });
});
