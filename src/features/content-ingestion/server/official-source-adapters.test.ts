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
  });

  it("discovers Culture.ru detail pages and consumes Event JSON-LD", async () => {
    const detail = fetched("https://www.culture.ru/events/42/sudak", `
      <script type="application/ld+json">{
        "@type":"Event",
        "url":"https://www.culture.ru/events/42/sudak",
        "name":"Событие в Судаке",
        "description":"Официальное описание события.",
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
  });

  it("queues unsupported HTML for adapter preparation", async () => {
    const result = await extractSourceCandidates({
      fetched: fetched("https://official.example.org/news/42", `
        <html><head><title>Официальное сообщение</title>
        <meta name="description" content="Материал нового официального источника." /></head><body></body></html>`),
      sourceKind: "html",
      sourceName: "Новый источник"
    });

    expect(result.format).toBe("unknown");
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].candidates[0].warnings.join(" ")).toContain("Codex");
    expect(result.batches[0].candidates[0].warnings.join(" ")).toContain("закрытой очереди");
  });
});
