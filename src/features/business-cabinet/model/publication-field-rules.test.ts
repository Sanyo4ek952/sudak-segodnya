import { describe, expect, it } from "vitest";
import { businessPublicationFieldRules } from "./types";

describe("business publication field rules", () => {
  it("shows event dates only for events", () => {
    expect(
      Object.entries(businessPublicationFieldRules)
        .filter(([, rules]) => rules.eventDates)
        .map(([type]) => type)
    ).toEqual(["event"]);
  });

  it("uses structured schedule only for regular activities", () => {
    expect(
      Object.entries(businessPublicationFieldRules)
        .filter(([, rules]) => rules.schedule)
        .map(([type]) => type)
    ).toEqual(["regular"]);
  });

  it("keeps an expiry date for every non-event type", () => {
    expect(businessPublicationFieldRules.event.validUntil).toBe(false);
    expect(businessPublicationFieldRules.announcement.validUntil).toBe(true);
    expect(businessPublicationFieldRules.promo.validUntil).toBe(true);
    expect(businessPublicationFieldRules.regular.validUntil).toBe(true);
    expect(businessPublicationFieldRules.news.validUntil).toBe(true);
  });

  it("does not request irrelevant price and contact fields for news", () => {
    expect(businessPublicationFieldRules.news).toMatchObject({
      place: false,
      price: false,
      ageLimit: false,
      contactPhone: false
    });
    expect(businessPublicationFieldRules.announcement.price).toBe(false);
  });
});
