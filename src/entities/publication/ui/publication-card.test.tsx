import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Publication } from "@/entities/publication/model/types";
import { PublicationCard } from "@/entities/publication/ui/publication-card";

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
          priceText: "Не применяется"
        }}
      />
    );
    expect(countText(markup, "Новость")).toBe(1);
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
});
