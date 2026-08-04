import { describe, expect, it } from "vitest";
import {
  parseJsonLdCandidateBatches,
  parseRssCandidateBatches,
  toMoscowOffsetIso,
  type SourceProfile
} from "@/features/content-ingestion/server/source-parsers";

const cultureProfile: SourceProfile = {
  organizationName: "Культура.РФ",
  categorySlug: "culture",
  organizationTypeSlug: "culture"
};

describe("deterministic content source parsers", () => {
  it("normalizes RSS 2.0 items into closed publication candidates", () => {
    const batches = parseRssCandidateBatches(`
      <?xml version="1.0"?>
      <rss version="2.0"><channel><title>Библиотека</title><item>
        <title>Новая выставка &quot;Судак&quot;</title>
        <link>https://libsudak.ru/news/exhibition</link>
        <guid>library-42</guid>
        <description><![CDATA[<p>Официальное сообщение о новой выставке.</p>]]></description>
        <pubDate>Tue, 04 Aug 2026 09:00:00 GMT</pubDate>
      </item></channel></rss>
    `, "https://libsudak.ru/news/rss/", cultureProfile);

    expect(batches).toHaveLength(1);
    expect(batches[0].sourceUrl).toBe("https://libsudak.ru/news/exhibition");
    const candidate = batches[0].candidates[0];
    expect(candidate.action).toBe("create_publication");
    expect(candidate.externalId).toBe("library-42");
    expect(candidate.payload.kind).toBe("publication");
    if (candidate.payload.kind === "publication") {
      expect(candidate.payload.title).toBe("Новая выставка \"Судак\"");
      expect(candidate.payload.type).toBe("news");
      expect(candidate.payload.validUntil).toBeNull();
    }
    expect(candidate.warnings.join(" ")).toContain("закрытой очереди");
  });

  it("maps schema.org Event JSON-LD and converts UTC to Moscow offset", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Event",
          "@id": "https://www.culture.ru/events/42/sudak",
          "url": "https://www.culture.ru/events/42/sudak",
          "name": "Лекция-экскурсия",
          "description": "Рассказ об истории Судакской крепости.",
          "startDate": "2026-08-14T07:15:00.000Z",
          "endDate": "2026-08-14T08:00:00.000Z",
          "location": {"@type":"Place","name":"Судакская крепость","address":"г. Судак"},
          "offers": {"@type":"Offer","price":0,"priceCurrency":"RUB"}
        }
      </script>`;

    const batches = parseJsonLdCandidateBatches(html, "https://www.culture.ru/events/42/sudak", cultureProfile);
    expect(batches).toHaveLength(1);
    const candidate = batches[0].candidates[0];
    expect(candidate.payload.kind).toBe("publication");
    if (candidate.payload.kind === "publication") {
      expect(candidate.payload.startsAt).toBe("2026-08-14T10:15:00+03:00");
      expect(candidate.payload.endsAt).toBe("2026-08-14T11:00:00+03:00");
      expect(candidate.payload.organizationName).toBe("Судакская крепость");
      expect(candidate.payload.isFree).toBe(true);
      expect(candidate.payload.priceText).toBe("0 ₽");
    }
  });

  it("keeps unknown content-bearing JSON-LD in the closed queue", () => {
    const html = `<script type="application/ld+json">{
      "@type":"CreativeWork",
      "name":"Новый городской материал",
      "description":"Формат материала пока не поддержан отдельным адаптером.",
      "url":"https://example.org/material"
    }</script>`;
    const batches = parseJsonLdCandidateBatches(html, "https://example.org/", cultureProfile);
    expect(batches).toHaveLength(1);
    expect(batches[0].candidates[0].warnings.join(" ")).toContain("Неизвестный тип JSON-LD");
    expect(batches[0].candidates[0].warnings.join(" ")).toContain("закрытой очереди");
  });

  it("does not reinterpret an explicit timezone as local time", () => {
    expect(toMoscowOffsetIso("2026-08-04T12:00:00+03:00")).toBe("2026-08-04T12:00:00+03:00");
  });
});
