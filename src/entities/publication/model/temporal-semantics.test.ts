import { describe, expect, it } from "vitest";
import {
  filterPublications,
  isPublicationRelevantOnDay,
  sortPublicationsByRelevance
} from "./filters";
import type { Publication } from "./types";

const reference = new Date("2026-07-23T07:00:00.000Z");

function makePublication(patch: Partial<Publication>): Publication {
  return {
    id: patch.id ?? crypto.randomUUID(),
    slug: patch.slug ?? "publication",
    type: patch.type ?? "event",
    status: patch.status ?? "published",
    title: patch.title ?? "Publication",
    description: patch.description ?? "Complete publication description",
    organization: patch.organization ?? {
      id: "organization",
      slug: "organization",
      name: "Organization"
    },
    scheduleEntries: patch.scheduleEntries ?? [],
    place: patch.place ?? "Sudak",
    priceText: patch.priceText ?? "500 ₽",
    isFree: patch.isFree ?? false,
    category: patch.category ?? "culture",
    publishedAt: patch.publishedAt ?? "2026-07-23T06:00:00.000Z",
    updatedAt: patch.updatedAt ?? "2026-07-23T06:00:00.000Z",
    ...patch
  };
}

describe("Sudak publication temporal semantics", () => {
  it("includes an event that started yesterday and continues today", () => {
    const event = makePublication({
      startsAt: "2026-07-22T17:00:00.000Z",
      endsAt: "2026-07-23T09:00:00.000Z"
    });

    expect(isPublicationRelevantOnDay(event, reference)).toBe(true);
  });

  it("includes an event that crosses midnight", () => {
    const event = makePublication({
      startsAt: "2026-07-23T20:30:00.000Z",
      endsAt: "2026-07-24T00:30:00.000Z"
    });

    expect(filterPublications([event], "today", reference)).toHaveLength(1);
    expect(filterPublications([event], "tomorrow", reference)).toHaveLength(1);
  });

  it("places an event starting tomorrow only in tomorrow", () => {
    const event = makePublication({
      startsAt: "2026-07-24T07:00:00.000Z",
      endsAt: "2026-07-24T09:00:00.000Z"
    });

    expect(filterPublications([event], "today", reference)).toHaveLength(0);
    expect(filterPublications([event], "tomorrow", reference)).toHaveLength(1);
  });

  it("includes a regular activity on its structured weekday", () => {
    const regular = makePublication({
      type: "regular",
      startsAt: undefined,
      endsAt: undefined,
      validUntil: "2026-08-23T20:59:59.000Z",
      schedule: "Thursdays at 18:00",
      scheduleEntries: [{
        text: "Thursday at 18:00",
        weekday: 4,
        startsAt: "18:00",
        endsAt: "19:00",
        timezone: "Europe/Moscow"
      }]
    });

    expect(filterPublications([regular], "today", reference)).toHaveLength(1);
  });

  it("includes a currently valid promotion", () => {
    const promo = makePublication({
      type: "promo",
      startsAt: undefined,
      endsAt: undefined,
      validUntil: "2026-07-24T20:59:59.000Z"
    });

    expect(filterPublications([promo], "today", reference)).toHaveLength(1);
    expect(filterPublications([promo], "tomorrow", reference)).toHaveLength(1);
  });

  it("excludes an expired news item", () => {
    const news = makePublication({
      type: "news",
      startsAt: undefined,
      endsAt: undefined,
      validUntil: "2026-07-22T20:59:59.000Z"
    });

    expect(filterPublications([news], "today", reference)).toHaveLength(0);
  });

  it("uses Sudak calendar boundaries instead of the runtime timezone", () => {
    const afterMoscowMidnight = makePublication({
      startsAt: "2026-07-22T21:30:00.000Z",
      endsAt: "2026-07-22T23:00:00.000Z"
    });

    expect(filterPublications([afterMoscowMidnight], "today", reference)).toHaveLength(1);
  });

  it("ranks ongoing and nearest events before expiring content and fresh news", () => {
    const ongoing = makePublication({
      id: "ongoing",
      startsAt: "2026-07-23T06:00:00.000Z",
      endsAt: "2026-07-23T08:00:00.000Z"
    });
    const upcoming = makePublication({
      id: "upcoming",
      startsAt: "2026-07-23T09:00:00.000Z",
      endsAt: "2026-07-23T10:00:00.000Z"
    });
    const expiring = makePublication({
      id: "expiring",
      type: "promo",
      startsAt: undefined,
      endsAt: undefined,
      validUntil: "2026-07-23T12:00:00.000Z"
    });
    const news = makePublication({
      id: "news",
      type: "news",
      startsAt: undefined,
      endsAt: undefined,
      validUntil: "2026-07-30T12:00:00.000Z"
    });

    expect(sortPublicationsByRelevance([news, expiring, upcoming, ongoing], reference).map((item) => item.id))
      .toEqual(["ongoing", "upcoming", "expiring", "news"]);
  });
});
