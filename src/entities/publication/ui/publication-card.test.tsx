import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Publication } from "@/entities/publication/model/types";
import { PublicationCard } from "@/entities/publication/ui/publication-card";
import { formatDateTime } from "@/shared/lib/date";

const basePublication: Publication = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "test-publication",
  type: "regular",
  status: "published",
  title: "Регулярная тренировка",
  description: "Подробное описание регулярной городской тренировки.",
  organization: {
    id: "00000000-0000-4000-8000-000000000002",
    slug: "test-organization",
    name: "Тестовая организация"
  },
  validUntil: "2026-08-30T18:00:00+03:00",
  schedule: "Каждый понедельник в 18:00",
  scheduleEntries: [
    {
      text: "Каждый понедельник в 18:00",
      weekday: 1,
      startsAt: "18:00",
      endsAt: "19:00",
      timezone: "Europe/Moscow"
    }
  ],
  place: "Судак",
  priceText: "500 ₽",
  isFree: false,
  category: "sport",
  updatedAt: "2026-07-23T10:00:00+03:00"
};

function countText(markup: string, value: string) {
  return markup.split(value).length - 1;
}

describe("PublicationCard regressions", () => {
  it("does not duplicate the Regular badge", () => {
    const markup = renderToStaticMarkup(<PublicationCard publication={basePublication} />);
    expect(countText(markup, "Регулярно")).toBe(1);
  });

  it("does not duplicate the News badge", () => {
    const markup = renderToStaticMarkup(
      <PublicationCard
        publication={{
          ...basePublication,
          type: "news",
          title: "Городская новость",
          validUntil: "2026-07-30T18:00:00+03:00",
          schedule: undefined,
          scheduleEntries: [],
          place: "Судак",
          priceText: "Не применяется",
          publishedAt: "2026-07-23T10:00:00+03:00"
        }}
      />
    );
    expect(countText(markup, "Новость")).toBe(1);
    expect(markup).toContain("23 июля");
    expect(markup).not.toContain("до 30 июля");
    expect(markup).not.toContain(">Цена<");
  });

  it("does not show a price for an announcement", () => {
    const markup = renderToStaticMarkup(
      <PublicationCard
        publication={{
          ...basePublication,
          type: "announcement",
          schedule: undefined,
          scheduleEntries: [],
          priceText: "Не указано"
        }}
      />
    );

    expect(markup).not.toContain("Цена:");
  });

  it("describes cancellation with text and not only color", () => {
    const markup = renderToStaticMarkup(
      <PublicationCard publication={{ ...basePublication, status: "cancelled" }} />
    );
    expect(markup).toContain("Материал отменён организацией");
    expect(markup).toContain("border-error");
  });

  it("limits card description to two lines", () => {
    const markup = renderToStaticMarkup(<PublicationCard publication={basePublication} />);
    expect(markup).toContain("line-clamp-2");
  });

  it("keeps a card without an image at the shared feed height", () => {
    const markup = renderToStaticMarkup(<PublicationCard publication={basePublication} />);

    expect(markup).toContain("flex h-96 flex-col");
    expect(markup).toContain('style="margin-top:auto"');
  });

  it("shows event metadata and an organization footer with a round logo", () => {
    const startsAt = "2026-08-15T19:00:00+03:00";
    const publication: Publication = {
      ...basePublication,
      type: "event",
      schedule: undefined,
      scheduleEntries: [],
      startsAt,
      place: "Набережная Судака",
      priceText: "Бесплатно",
      isFree: true,
      organization: {
        ...basePublication.organization,
        logo: "/brand/organization-logo.png"
      }
    };
    const markup = renderToStaticMarkup(<PublicationCard publication={publication} />);

    expect(markup).toContain(formatDateTime(startsAt));
    expect(markup).toContain("Набережная Судака");
    expect(markup).toContain("Бесплатно");
    expect(markup).toContain("aria-label=\"Открыть организацию: Тестовая организация\"");
    expect(markup).toContain("rounded-full");
    expect(markup).toContain("organization-logo.png");
  });

  it("uses the organization cover when a logo is unavailable", () => {
    const markup = renderToStaticMarkup(
      <PublicationCard
        publication={{
          ...basePublication,
          organization: {
            ...basePublication.organization,
            cover: "/brand/organization-cover.png"
          }
        }}
      />
    );

    expect(markup).toContain("organization-cover.png");
    expect(markup).toContain("object-cover");
  });

  it("does not nest links when rendering a card photo", () => {
    const markup = renderToStaticMarkup(
      <PublicationCard
        publication={{
          ...basePublication,
          media: [{ id: "photo-1", kind: "photo", posterUrl: "/brand/vk-import-fallback.png" }]
        }}
      />
    );

    expect(markup).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?<a\b/);
  });
});
