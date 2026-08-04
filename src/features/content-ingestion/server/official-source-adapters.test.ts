import { describe, expect, it } from "vitest";
import { extractSourceCandidates } from "@/features/content-ingestion/server/official-source-adapters";
import type { SafeFetchResult } from "@/features/content-ingestion/server/secure-fetch";

function fetched(finalUrl: string, body: string, contentType = "text/html"): SafeFetchResult {
  return {
    status: 200,
    finalUrl,
    contentType,
    body,
    text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    etag: null,
    lastModified: null,
    notModified: false
  };
}

describe("official content source adapters", () => {
  it("uses the Tavrida news adapter without a runtime LLM", async () => {
    const result = await extractSourceCandidates({
      fetched: fetched("https://tavrida.art/news", `
        <a class="CardArticle svelte-test" href="/news/news-id">
          <img src="/images/news-id.webp" alt="" />
          <div class="date svelte-test">4 августа 2026 года</div>
          <div class="title svelte-test">Открыта регистрация на программу</div>
          <div class="teaser svelte-test">Официальное объявление арт-кластера.</div>
        </a>`),
      sourceKind: "html",
      sourceName: "Арт-кластер «Таврида»"
    });

    expect(result.adapterId).toBe("tavrida-news-v1");
    expect(result.format).toBe("adapter");
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].sourceUrl).toBe("https://tavrida.art/news/news-id");
    const candidate = result.batches[0].candidates[0];
    if (candidate.payload.kind === "publication") {
      expect(candidate.payload.imageSourceUrl).toBe("https://tavrida.art/images/news-id.webp");
    }
  });

  it("discovers Culture.ru detail pages and consumes Event JSON-LD", async () => {
    const detail = fetched("https://www.culture.ru/events/42/sudak", `
      <script type="application/ld+json">{
        "@type":"Event",
        "url":"https://www.culture.ru/events/42/sudak",
        "name":"Событие в Судаке",
        "description":"Официальное описание события.",
        "image":"https://www.culture.ru/images/42.jpg",
        "startDate":"2026-08-20T10:00:00+03:00",
        "endDate":"2026-08-20T11:00:00+03:00",
        "location":{"name":"Городской дом культуры","address":"г. Судак"}
      }</script>`);
    const result = await extractSourceCandidates({
      fetched: fetched("https://www.culture.ru/afisha/respublika-krym-sudak", `
        <a href="/events/42/sudak?location=respublika-krym-sudak">Событие</a>`),
      sourceKind: "html",
      sourceName: "Культура.РФ",
      fetchDetail: async () => detail
    });

    expect(result.adapterId).toBe("culture-ru-events-v1");
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].candidates[0].payload.kind).toBe("publication");
    if (result.batches[0].candidates[0].payload.kind === "publication") {
      expect(result.batches[0].candidates[0].payload.imageSourceUrl)
        .toBe("https://www.culture.ru/images/42.jpg");
    }
  });

  it("extracts og:image in the Aquapark Sudak adapter", async () => {
    const result = await extractSourceCandidates({
      fetched: fetched("https://sudak-aquapark.com/actions/summer/", `
        <html><head>
          <meta property="og:title" content="Летняя акция — Аквапарк «Судак»" />
          <meta property="og:image" content="https://sudak-aquapark.com/images/summer.jpg" />
          <meta name="description" content="Официальные условия летней акции." />
        </head><body>Акция действует до 30 сентября 2026 года. Цена 2200 ₽.</body></html>`),
      sourceKind: "html",
      sourceName: "Аквапарк «Судак»"
    });

    expect(result.adapterId).toBe("sudak-aquapark-actions-v1");
    const candidate = result.batches[0].candidates[0];
    if (candidate.payload.kind === "publication") {
      expect(candidate.payload.imageSourceUrl).toBe("https://sudak-aquapark.com/images/summer.jpg");
    }
  });

  it("extracts media images in the libsudak RSS adapter", async () => {
    const result = await extractSourceCandidates({
      fetched: fetched("https://libsudak.ru/news/rss/", `<rss><channel><item>
        <title>Новости библиотеки</title>
        <link>https://libsudak.ru/news/library</link>
        <description>Официальное сообщение библиотеки.</description>
        <media:content url="https://libsudak.ru/images/library.webp" type="image/webp" />
      </item></channel></rss>`, "application/rss+xml"),
      sourceKind: "rss",
      sourceName: "Судакская библиотека"
    });

    expect(result.adapterId).toBe("libsudak-rss-v1");
    const candidate = result.batches[0].candidates[0];
    if (candidate.payload.kind === "publication") {
      expect(candidate.payload.imageSourceUrl).toBe("https://libsudak.ru/images/library.webp");
    }
  });

  it("extracts og:image in the Meganom adapter", async () => {
    const result = await extractSourceCandidates({
      fetched: fetched("https://events.tavrida.art/meganomvisit", `<html><head>
        <meta property="og:title" content="Посещение Академии Меганом" />
        <meta property="og:description" content="Официальная регистрация на посещение." />
        <meta property="og:image" content="https://events.tavrida.art/images/meganom.png" />
      </head><body>Ежедневно, бесплатно, 12+</body></html>`),
      sourceKind: "html",
      sourceName: "Академия «Меганом»"
    });

    expect(result.adapterId).toBe("tavrida-meganom-visit-v1");
    const candidate = result.batches[0].candidates[0];
    if (candidate.payload.kind === "publication") {
      expect(candidate.payload.imageSourceUrl).toBe("https://events.tavrida.art/images/meganom.png");
    }
  });

  it("queues unsupported HTML for adapter preparation", async () => {
    const result = await extractSourceCandidates({
      fetched: fetched("https://official.example.org/news/42", `
        <html><head><title>Официальное сообщение</title>
        <meta name="description" content="Материал нового официального источника." />
        <meta property="og:image" content="https://official.example.org/images/42.png" />
        </head><body></body></html>`),
      sourceKind: "html",
      sourceName: "Новый источник"
    });

    expect(result.format).toBe("unknown");
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].candidates[0].warnings.join(" ")).toContain("Codex");
    expect(result.batches[0].candidates[0].warnings.join(" ")).toContain("закрытой очереди");
    if (result.batches[0].candidates[0].payload.kind === "publication") {
      expect(result.batches[0].candidates[0].payload.imageSourceUrl)
        .toBe("https://official.example.org/images/42.png");
    }
  });
});
