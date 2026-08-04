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
        <enclosure url="https://libsudak.ru/images/exhibition.jpg" type="image/jpeg" />
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
      expect(candidate.payload.imageSourceUrl).toBe("https://libsudak.ru/images/exhibition.jpg");
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
          ,"image": {"@type":"ImageObject","contentUrl":"https://www.culture.ru/images/event.webp"}
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
      expect(candidate.payload.imageSourceUrl).toBe("https://www.culture.ru/images/event.webp");
    }
  });

  it("extracts organization JSON-LD images", () => {
    const batches = parseJsonLdCandidateBatches(`<script type="application/ld+json">{
      "@type":"Organization",
      "name":"Городская библиотека",
      "description":"Официальная библиотека Судака.",
      "url":"https://libsudak.ru/",
      "image":["https://libsudak.ru/images/library.png"]
    }</script>`, "https://libsudak.ru/", cultureProfile);
    const candidate = batches[0]?.candidates[0];
    expect(candidate?.payload.kind).toBe("organization");
    if (candidate?.payload.kind === "organization") {
      expect(candidate.payload.imageSourceUrl).toBe("https://libsudak.ru/images/library.png");
    }
  });

  it("extracts Atom media thumbnails and HTML image fallbacks", () => {
    const [mediaBatch] = parseRssCandidateBatches(`<feed><entry>
      <title>Афиша библиотеки</title>
      <link href="https://libsudak.ru/news/poster" />
      <id>poster-1</id>
      <summary>Официальная афиша городской библиотеки.</summary>
      <media:thumbnail url="https://libsudak.ru/images/poster.webp" />
    </entry></feed>`, "https://libsudak.ru/news/rss/", cultureProfile);
    const [markupBatch] = parseRssCandidateBatches(`<rss><channel><item>
      <title>Новая выставка</title><link>https://libsudak.ru/news/gallery</link>
      <description><![CDATA[<p>Описание выставки.</p><img src="https://libsudak.ru/images/gallery.png" />]]></description>
    </item></channel></rss>`, "https://libsudak.ru/news/rss/", cultureProfile);

    if (mediaBatch.candidates[0].payload.kind === "publication") {
      expect(mediaBatch.candidates[0].payload.imageSourceUrl).toBe("https://libsudak.ru/images/poster.webp");
    }
    if (markupBatch.candidates[0].payload.kind === "publication") {
      expect(markupBatch.candidates[0].payload.imageSourceUrl).toBe("https://libsudak.ru/images/gallery.png");
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
