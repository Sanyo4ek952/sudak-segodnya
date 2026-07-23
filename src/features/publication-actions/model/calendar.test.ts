import { describe, expect, it } from "vitest";
import {
  canAddPublicationToCalendar,
  createPublicationCalendarIcs,
  type CalendarPublication
} from "./calendar";

const event: CalendarPublication = {
  id: "12000000-0000-4000-8000-000000000001",
  type: "event",
  status: "published",
  title: "Концерт, лето; 2026",
  description: "Музыка у моря\nВозьмите плед.",
  organizationName: "Городской дом культуры",
  place: "Набережная, 1",
  url: "https://sudak.example/publications/concert",
  startsAt: "2026-08-10T12:00:00+03:00",
  endsAt: "2026-08-10T14:30:00+03:00"
};

describe("publication calendar", () => {
  it("exports an event in UTC with escaped calendar text", () => {
    const ics = createPublicationCalendarIcs(event, new Date("2026-07-23T10:00:00Z"));
    const unfoldedIcs = ics.replace(/\r\n /g, "");

    expect(unfoldedIcs).toContain("VERSION:2.0\r\n");
    expect(unfoldedIcs).toContain("DTSTAMP:20260723T100000Z\r\n");
    expect(unfoldedIcs).toContain("DTSTART:20260810T090000Z\r\n");
    expect(unfoldedIcs).toContain("DTEND:20260810T113000Z\r\n");
    expect(unfoldedIcs).toContain("SUMMARY:Концерт\\, лето\\; 2026\r\n");
    expect(unfoldedIcs).toContain("DESCRIPTION:Музыка у моря\\nВозьмите плед.\\nОрганизатор: Городской дом культуры");
    expect(unfoldedIcs).toContain("LOCATION:Набережная\\, 1\r\n");
    expect(unfoldedIcs).toContain("URL:https://sudak.example/publications/concert\r\n");
    expect(unfoldedIcs.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("accepts only events with a valid, non-zero time range", () => {
    expect(canAddPublicationToCalendar(event)).toBe(true);
    expect(canAddPublicationToCalendar({ ...event, type: "promo" })).toBe(false);
    expect(canAddPublicationToCalendar({ ...event, startsAt: "not-a-date" })).toBe(false);
    expect(canAddPublicationToCalendar({ ...event, endsAt: event.startsAt })).toBe(false);
  });

  it("marks a cancelled event in the calendar file", () => {
    expect(createPublicationCalendarIcs({ ...event, status: "cancelled" })).toContain("STATUS:CANCELLED\r\n");
  });
});
