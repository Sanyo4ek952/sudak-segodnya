import type { ContentSourceKind } from "@/features/content-ingestion/model/contracts";
import {
  cleanMarkup,
  createClosedPublicationBatch,
  looksLikeRss,
  parseJsonLdCandidateBatches,
  parseRssCandidateBatches,
  type SourceCandidateBatch,
  type SourceProfile
} from "@/features/content-ingestion/server/source-parsers";
import {
  fetchPublicSource,
  sanitizeSourceText,
  type SafeFetchResult
} from "@/features/content-ingestion/server/secure-fetch";

type SourceAdapterInput = {
  fetched: SafeFetchResult;
  sourceKind: ContentSourceKind | null;
  sourceName: string | null;
  fetchDetail: typeof fetchPublicSource;
};

type SourceAdapter = {
  id: string;
  matches: (url: URL) => boolean;
  extract: (input: SourceAdapterInput, profile: SourceProfile) => Promise<SourceCandidateBatch[]>;
};

export type SourceExtractionResult = {
  adapterId: string;
  format: "rss" | "json_ld" | "adapter" | "unknown";
  batches: SourceCandidateBatch[];
};

const defaultProfile: SourceProfile = {
  organizationName: "Неизвестный официальный источник",
  categorySlug: "services",
  organizationTypeSlug: "services"
};

const hostProfiles: Array<{ matches: (host: string) => boolean; profile: SourceProfile }> = [
  {
    matches: (host) => host === "culture.ru" || host.endsWith(".culture.ru"),
    profile: { organizationName: "Культура.РФ", categorySlug: "culture", organizationTypeSlug: "culture" }
  },
  {
    matches: (host) => host === "tavrida.art" || host.endsWith(".tavrida.art"),
    profile: {
      organizationName: "Арт-кластер «Таврида»",
      categorySlug: "culture",
      organizationTypeSlug: "culture"
    }
  },
  {
    matches: (host) => host === "sudak-aquapark.com" || host.endsWith(".sudak-aquapark.com"),
    profile: {
      organizationName: "Аквапарк «Судак»",
      categorySlug: "rental",
      organizationTypeSlug: "rental_entertainment"
    }
  },
  {
    matches: (host) => host === "libsudak.ru" || host.endsWith(".libsudak.ru"),
    profile: {
      organizationName: "Судакская центральная городская библиотека им. В. П. Рыкова",
      categorySlug: "culture",
      organizationTypeSlug: "culture"
    }
  }
];

function profileFor(url: URL, sourceName: string | null) {
  const matched = hostProfiles.find((item) => item.matches(url.hostname.toLocaleLowerCase("en-US")));
  if (matched) return matched.profile;
  return {
    ...defaultProfile,
    organizationName: sourceName?.trim() || url.hostname
  };
}

function htmlAttribute(source: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ?? null;
}

function resolveHttpsUrl(value: string | null | undefined, baseUrl: string) {
  if (!value) return null;
  try {
    const url = new URL(value.replace(/&amp;/gi, "&"), baseUrl);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function metaContent(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = htmlAttribute(tag, "name") ?? htmlAttribute(tag, "property");
    if (name?.toLocaleLowerCase("en-US") !== key.toLocaleLowerCase("en-US")) continue;
    return cleanMarkup(htmlAttribute(tag, "content") ?? "", 4000);
  }
  return null;
}

function pageTitle(html: string) {
  return cleanMarkup(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "", 180);
}

function firstSrcsetUrl(value: string | null) {
  return value?.split(",")[0]?.trim().split(/\s+/)[0] ?? null;
}

function imageFromHtml(html: string, baseUrl: string) {
  const openGraph = resolveHttpsUrl(metaContent(html, "og:image"), baseUrl);
  if (openGraph) return openGraph;

  for (const match of Array.from(html.matchAll(/<(?:img|source)\b([^>]*)>/gi))) {
    const attributes = match[1] ?? "";
    const candidate = htmlAttribute(attributes, "src")
      ?? htmlAttribute(attributes, "data-src")
      ?? htmlAttribute(attributes, "data-lazy-src")
      ?? firstSrcsetUrl(htmlAttribute(attributes, "srcset"));
    const resolved = resolveHttpsUrl(candidate, baseUrl);
    if (resolved) return resolved;
  }

  const cssUrl = html.match(/background-image\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/i)?.[1];
  return resolveHttpsUrl(cssUrl, baseUrl);
}

function withImageFallback(batches: SourceCandidateBatch[], imageSourceUrl: string | null) {
  if (!imageSourceUrl) return batches;
  return batches.map((batch) => ({
    ...batch,
    candidates: batch.candidates.map((candidate) => ({
      ...candidate,
      payload: candidate.payload.imageSourceUrl
        ? candidate.payload
        : { ...candidate.payload, imageSourceUrl }
    }))
  }));
}

function textByClass(html: string, classFragment: string, maximum: number) {
  const escaped = classFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(
    `<[^>]+class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    "i"
  ));
  return cleanMarkup(match?.[1] ?? "", maximum);
}

function uniqueDetailLinks(html: string, baseUrl: string, pattern: RegExp, maximum = 12) {
  const result: string[] = [];
  for (const match of Array.from(html.matchAll(/<a\b([^>]*)>/gi))) {
    const href = resolveHttpsUrl(htmlAttribute(match[1] ?? "", "href"), baseUrl);
    if (!href || !pattern.test(new URL(href).pathname) || result.includes(href)) continue;
    result.push(href);
    if (result.length >= maximum) break;
  }
  return result;
}

async function fetchDetailBatches(
  links: string[],
  profile: SourceProfile,
  fetchDetail: typeof fetchPublicSource,
  adapter: (fetched: SafeFetchResult, profile: SourceProfile) => SourceCandidateBatch[]
) {
  const batches: SourceCandidateBatch[] = [];
  for (let offset = 0; offset < links.length && batches.length < 20; offset += 3) {
    const settled = await Promise.allSettled(links.slice(offset, offset + 3).map((link) => fetchDetail(link, {
      timeoutMs: 15_000,
      maxBytes: 2 * 1024 * 1024
    })));
    for (const result of settled) {
      if (result.status !== "fulfilled" || result.value.notModified) continue;
      batches.push(...adapter(result.value, profile));
    }
  }
  return batches.slice(0, 20);
}

function cultureDetailBatches(fetched: SafeFetchResult, profile: SourceProfile) {
  return withImageFallback(
    parseJsonLdCandidateBatches(fetched.body, fetched.finalUrl, profile),
    imageFromHtml(fetched.body, fetched.finalUrl)
  );
}

const cultureAdapter: SourceAdapter = {
  id: "culture-ru-events-v1",
  matches: (url) => (url.hostname === "www.culture.ru" || url.hostname === "culture.ru")
    && (url.pathname.startsWith("/afisha/") || url.pathname.startsWith("/events/")),
  async extract(input, profile) {
    const direct = cultureDetailBatches(input.fetched, profile);
    if (direct.length > 0) return direct;
    const links = uniqueDetailLinks(input.fetched.body, input.fetched.finalUrl, /^\/events\/\d+\//, 12);
    return fetchDetailBatches(links, profile, input.fetchDetail, cultureDetailBatches);
  }
};

function tavridaCardBatches(fetched: SafeFetchResult, profile: SourceProfile) {
  const batches: SourceCandidateBatch[] = [];
  for (const anchor of Array.from(fetched.body.matchAll(/<a\b([^>]*\bclass=["'][^"']*CardArticle[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi))) {
    const sourceUrl = resolveHttpsUrl(htmlAttribute(anchor[1] ?? "", "href"), fetched.finalUrl);
    if (!sourceUrl || !new URL(sourceUrl).pathname.startsWith("/news/")) continue;
    const body = anchor[2] ?? "";
    const title = textByClass(body, "title", 180);
    if (!title) continue;
    const description = textByClass(body, "teaser", 4000);
    const published = textByClass(body, "date", 120);
    const sourceText = [title, description, published].filter(Boolean).join("\n");
    const batch = createClosedPublicationBatch({
      sourceUrl,
      sourceText,
      profile,
      externalId: new URL(sourceUrl).pathname.split("/").filter(Boolean).at(-1) ?? sourceUrl,
      type: "news",
      title,
      description,
      imageSourceUrl: imageFromHtml(body, sourceUrl),
      warnings: [
        "Материал подготовлен адаптером официального сайта Тавриды и оставлен в закрытой очереди.",
        published ? `Дата исходного материала: ${published}.` : "Дата исходного материала не указана."
      ]
    });
    if (batch) batches.push(batch);
    if (batches.length >= 20) break;
  }
  return batches;
}

const tavridaAdapter: SourceAdapter = {
  id: "tavrida-news-v1",
  matches: (url) => (url.hostname === "tavrida.art" || url.hostname === "www.tavrida.art")
    && (url.pathname === "/" || url.pathname.startsWith("/news")),
  async extract(input, profile) {
    return tavridaCardBatches(input.fetched, profile);
  }
};

const russianMonths: Record<string, number> = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12
};

function russianExpiry(text: string) {
  const match = text.match(/\bдо\s+(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(20\d{2})(?:\s+года)?/i);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const month = russianMonths[match[2].toLocaleLowerCase("ru-RU")];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}T23:59:59+03:00`;
}

function aquaparkDetailBatches(fetched: SafeFetchResult, profile: SourceProfile) {
  const visible = fetched.text || sanitizeSourceText(fetched.body);
  const rawTitle = metaContent(fetched.body, "og:title") ?? pageTitle(fetched.body);
  const title = rawTitle?.replace(/\s*[-—|]\s*Аквапарк.*$/i, "").trim() ?? null;
  if (!title || title.length < 3) return [];
  const description = metaContent(fetched.body, "description")
    ?? metaContent(fetched.body, "og:description")
    ?? visible.slice(0, 1500);
  const priceText = visible.match(/\b\d[\d\s]*(?:₽|руб(?:\.|лей)?)/i)?.[0]?.replace(/\s+/g, " ") ?? null;
  const sourceText = [title, description, visible].filter(Boolean).join("\n");
  const batch = createClosedPublicationBatch({
    sourceUrl: fetched.finalUrl,
    sourceText,
    profile,
    externalId: new URL(fetched.finalUrl).pathname,
    type: "promo",
    title,
    description,
    validUntil: russianExpiry(visible),
    priceText,
    isFree: /\bбесплатн\w*/i.test(visible),
    place: "Аквапарк «Судак», ул. Гагарина, 79",
    contactPhone: "+7 (978) 567-94-71",
    imageSourceUrl: imageFromHtml(fetched.body, fetched.finalUrl),
    warnings: [
      "Акция подготовлена адаптером официального сайта Аквапарка и оставлена в закрытой очереди.",
      "Перед одобрением проверьте ограничения, документы и базовую стоимость на странице источника."
    ]
  });
  return batch ? [batch] : [];
}

const aquaparkAdapter: SourceAdapter = {
  id: "sudak-aquapark-actions-v1",
  matches: (url) => (url.hostname === "sudak-aquapark.com" || url.hostname === "www.sudak-aquapark.com")
    && url.pathname.startsWith("/actions"),
  async extract(input, profile) {
    if (/^\/actions\/[^/]+\/?$/.test(new URL(input.fetched.finalUrl).pathname)) {
      return aquaparkDetailBatches(input.fetched, profile);
    }
    const links = uniqueDetailLinks(input.fetched.body, input.fetched.finalUrl, /^\/actions\/[^/]+\/?$/, 12);
    return fetchDetailBatches(links, profile, input.fetchDetail, aquaparkDetailBatches);
  }
};

const libraryAdapter: SourceAdapter = {
  id: "libsudak-rss-v1",
  matches: (url) => url.hostname === "libsudak.ru" || url.hostname === "www.libsudak.ru",
  async extract(input, profile) {
    if (looksLikeRss(input.fetched.body, input.fetched.contentType)) {
      return parseRssCandidateBatches(input.fetched.body, input.fetched.finalUrl, profile);
    }
    const rssLink = Array.from(input.fetched.body.matchAll(/<a\b([^>]*)>/gi))
      .map((match) => resolveHttpsUrl(htmlAttribute(match[1] ?? "", "href"), input.fetched.finalUrl))
      .find((href) => href && /\/news\/rss\/?$/i.test(new URL(href).pathname));
    if (!rssLink) return [];
    const feed = await input.fetchDetail(rssLink);
    return parseRssCandidateBatches(feed.body, feed.finalUrl, profile);
  }
};

function meganomBatches(fetched: SafeFetchResult, profile: SourceProfile) {
  const visible = fetched.text || sanitizeSourceText(fetched.body);
  const title = metaContent(fetched.body, "og:title") ?? pageTitle(fetched.body);
  if (!title) return [];
  const description = metaContent(fetched.body, "og:description")
    ?? metaContent(fetched.body, "description")
    ?? visible.slice(0, 1500);
  const ageLimit = visible.match(/(?:^|\s)(\d{1,2}\+)(?:\s|$)/)?.[1] ?? null;
  const daily = /\bежедневн\w*/i.test(visible);
  const sourceText = [title, description, visible].filter(Boolean).join("\n");
  const batch = createClosedPublicationBatch({
    sourceUrl: fetched.finalUrl,
    sourceText,
    profile,
    externalId: new URL(fetched.finalUrl).pathname,
    type: "regular",
    title,
    description,
    place: "Академия «Меганом», городской округ Судак, бухта Капсель",
    isFree: /\bбесплатн\w*/i.test(visible),
    ageLimit,
    contactPhone: "8 (800) 551-44-40",
    imageSourceUrl: imageFromHtml(fetched.body, fetched.finalUrl),
    scheduleEntries: daily ? [{
      scheduleText: "Ежедневно, по предварительной регистрации",
      weekday: null,
      startsAt: null,
      endsAt: null,
      sortOrder: 0,
      timezone: "Europe/Moscow"
    }] : [],
    warnings: [
      "Материал подготовлен адаптером страницы Академии «Меганом» и оставлен в закрытой очереди.",
      "Перед одобрением проверьте доступные интервалы, регистрацию и наличие мест."
    ]
  });
  return batch ? [batch] : [];
}

const meganomAdapter: SourceAdapter = {
  id: "tavrida-meganom-visit-v1",
  matches: (url) => url.hostname === "events.tavrida.art" && url.pathname.startsWith("/meganomvisit"),
  async extract(input, profile) {
    return meganomBatches(input.fetched, profile);
  }
};

const adapters = [cultureAdapter, tavridaAdapter, aquaparkAdapter, libraryAdapter, meganomAdapter];

function unknownHtmlBatch(fetched: SafeFetchResult, profile: SourceProfile) {
  const title = metaContent(fetched.body, "og:title") ?? pageTitle(fetched.body);
  if (!title) return [];
  const description = metaContent(fetched.body, "og:description")
    ?? metaContent(fetched.body, "description")
    ?? fetched.text.slice(0, 1200);
  const sourceText = [title, description, fetched.text].filter(Boolean).join("\n");
  const batch = createClosedPublicationBatch({
    sourceUrl: fetched.finalUrl,
    sourceText,
    profile,
    externalId: fetched.finalUrl,
    title,
    description,
    imageSourceUrl: imageFromHtml(fetched.body, fetched.finalUrl),
    warnings: [
      "Для источника нет утверждённого адаптера; материал оставлен в закрытой очереди.",
      "Codex должен проверить источник и подготовить отдельный адаптер перед регулярным импортом."
    ]
  });
  return batch ? [batch] : [];
}

export async function extractSourceCandidates({
  fetched,
  sourceKind,
  sourceName,
  fetchDetail = fetchPublicSource
}: Omit<SourceAdapterInput, "fetchDetail"> & { fetchDetail?: typeof fetchPublicSource }): Promise<SourceExtractionResult> {
  const url = new URL(fetched.finalUrl);
  const profile = profileFor(url, sourceName);
  if (sourceKind === "rss" || looksLikeRss(fetched.body, fetched.contentType)) {
    return {
      adapterId: url.hostname.includes("libsudak.ru") ? "libsudak-rss-v1" : "rss-atom-v1",
      format: "rss",
      batches: parseRssCandidateBatches(fetched.body, fetched.finalUrl, profile)
    };
  }

  const jsonLd = parseJsonLdCandidateBatches(fetched.body, fetched.finalUrl, profile);
  if (jsonLd.length > 0) {
    return {
      adapterId: "schema-org-json-ld-v1",
      format: "json_ld",
      batches: withImageFallback(jsonLd, imageFromHtml(fetched.body, fetched.finalUrl))
    };
  }

  const adapter = adapters.find((item) => item.matches(url));
  if (adapter) {
    return {
      adapterId: adapter.id,
      format: "adapter",
      batches: await adapter.extract({ fetched, sourceKind, sourceName, fetchDetail }, profile)
    };
  }

  return {
    adapterId: "unknown-html-v1",
    format: "unknown",
    batches: unknownHtmlBatch(fetched, profile)
  };
}

export const officialSourceAdapterIds = adapters.map((adapter) => adapter.id);
