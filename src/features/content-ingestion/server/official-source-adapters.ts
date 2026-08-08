import type { ContentSourceKind } from "@/features/content-ingestion/model/contracts";
import {
  cleanMarkup,
  createClosedPublicationBatch,
  extractRussianEventInterval,
  looksLikeRss,
  parseJsonLdCandidateBatches,
  parseRssCandidateBatches,
  toMoscowOffsetIso,
  toMoscowSourcePublishedAt,
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

function bestSrcsetUrl(value: string | null) {
  return value?.split(",").at(-1)?.trim().split(/\s+/)[0] ?? null;
}

function imageFromHtml(html: string, baseUrl: string) {
  const openGraph = resolveHttpsUrl(
    metaContent(html, "og:image:secure_url") ?? metaContent(html, "og:image"),
    baseUrl
  );
  if (openGraph) return openGraph;

  const twitter = resolveHttpsUrl(
    metaContent(html, "twitter:image") ?? metaContent(html, "twitter:image:src"),
    baseUrl
  );
  if (twitter) return twitter;

  for (const link of Array.from(html.matchAll(/<link\b([^>]*)>/gi))) {
    const attributes = link[1] ?? "";
    if (htmlAttribute(attributes, "rel")?.toLocaleLowerCase("en-US") !== "image_src") continue;
    const resolved = resolveHttpsUrl(htmlAttribute(attributes, "href"), baseUrl);
    if (resolved) return resolved;
  }

  for (const match of Array.from(html.matchAll(/<(?:img|source)\b([^>]*)>/gi))) {
    const attributes = match[1] ?? "";
    const candidate = htmlAttribute(attributes, "src")
      ?? htmlAttribute(attributes, "data-src")
      ?? htmlAttribute(attributes, "data-lazy-src")
      ?? bestSrcsetUrl(htmlAttribute(attributes, "srcset"));
    const resolved = resolveHttpsUrl(candidate, baseUrl);
    if (!resolved) continue;
    const pathname = new URL(resolved).pathname.toLocaleLowerCase("en-US");
    if (/(?:favicon|sprite|spacer|pixel|tracking|\/icons?\/|\/logos?\/)/.test(pathname)) continue;
    return resolved;
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

function elementInnerHtml(html: string, opening: RegExp) {
  const match = opening.exec(html);
  const tag = match?.[1];
  if (!match || !tag || match.index === undefined) return null;
  const contentStart = match.index + match[0].length;
  const tokens = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  tokens.lastIndex = contentStart;
  let depth = 1;
  for (let token = tokens.exec(html); token; token = tokens.exec(html)) {
    if (/^<\//.test(token[0])) depth -= 1;
    else if (!/\/\s*>$/.test(token[0])) depth += 1;
    if (depth === 0) return html.slice(contentStart, token.index);
  }
  return null;
}

function htmlByClass(html: string, classFragment: string) {
  const escaped = classFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return elementInnerHtml(html, new RegExp(
    `<([a-z][\\w:-]*)\\b[^>]*class=["'][^"']*${escaped}[^"']*["'][^>]*>`,
    "i"
  ));
}

function textByClass(html: string, classFragment: string, maximum: number) {
  return cleanMarkup(htmlByClass(html, classFragment) ?? "", maximum);
}

function articleTextFromHtml(html: string, maximum = 4000) {
  const candidates = [
    "RAW_HTML_CONTAINER",
    "article-body",
    "article__body",
    "article-content",
    "article__content",
    "post-content",
    "entry-content",
    "news-detail",
    "news__text"
  ].map((className) => textByClass(html, className, maximum)).filter((value): value is string => Boolean(value));
  const semanticArticle = (() => {
    const index = html.search(/<article\b/i);
    if (index < 0) return null;
    return cleanMarkup(elementInnerHtml(html.slice(index), /<([a-z][\w:-]*)\b[^>]*>/i) ?? "", maximum);
  })();
  if (semanticArticle) candidates.push(semanticArticle);
  const paragraphs = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => cleanMarkup(match[1] ?? "", 1000))
    .filter((value): value is string => Boolean(value && value.length >= 30));
  if (paragraphs.length > 0) {
    candidates.push(cleanMarkup(Array.from(new Set(paragraphs)).join("\n\n"), maximum) ?? "");
  }
  return candidates.sort((left, right) => right.length - left.length)[0] ?? null;
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

async function enrichDetailBatches(
  initial: SourceCandidateBatch[],
  profile: SourceProfile,
  fetchDetail: typeof fetchPublicSource,
  adapter: (fetched: SafeFetchResult, profile: SourceProfile) => SourceCandidateBatch[]
) {
  const batches: SourceCandidateBatch[] = [];
  for (let offset = 0; offset < initial.length && batches.length < 20; offset += 3) {
    const portion = initial.slice(offset, offset + 3);
    const settled = await Promise.allSettled(portion.map((batch) => fetchDetail(batch.sourceUrl, {
      timeoutMs: 15_000,
      maxBytes: 2 * 1024 * 1024
    })));
    settled.forEach((result, index) => {
      const fallback = portion[index];
      if (!fallback) return;
      if (result.status !== "fulfilled" || result.value.notModified) {
        batches.push(fallback);
        return;
      }
      const detailed = adapter(result.value, profile);
      batches.push(...(detailed.length > 0 ? detailed : [fallback]));
    });
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
    const hasDirectPublication = direct.some((batch) => (
      batch.candidates.some((candidate) => candidate.payload.kind === "publication")
    ));
    if (hasDirectPublication) return direct;
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
      sourcePublishedAt: toMoscowSourcePublishedAt(published),
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

function yearFromText(value: string | null) {
  const year = value?.match(/\b(20\d{2})\b/)?.[1];
  return year ? Number(year) : null;
}

function itemPropValue(html: string, itemProp: string) {
  for (const match of Array.from(html.matchAll(/<(?:meta|time)\b([^>]*)>/gi))) {
    const attributes = match[1] ?? "";
    const props = htmlAttribute(attributes, "itemprop")?.toLocaleLowerCase("en-US").split(/\s+/) ?? [];
    if (!props.includes(itemProp.toLocaleLowerCase("en-US"))) continue;
    return htmlAttribute(attributes, "content") ?? htmlAttribute(attributes, "datetime");
  }
  return null;
}

function semanticEventIntervalFromHtml(html: string) {
  const rawStart = metaContent(html, "event:start_time") ?? itemPropValue(html, "startDate");
  const rawEnd = metaContent(html, "event:end_time") ?? itemPropValue(html, "endDate");
  const startsAt = toMoscowOffsetIso(rawStart);
  const endsAt = rawEnd
    ? toMoscowOffsetIso(rawEnd, true)
    : rawStart && /^\d{4}-\d{2}-\d{2}$/.test(rawStart)
      ? toMoscowOffsetIso(rawStart, true)
      : null;
  return startsAt && endsAt ? { startsAt, endsAt } : null;
}

function hasFutureEventLanguage(value: string) {
  return /(?:пройд[её]т|состоится|начн[её]тся|будет\s+проходить)/i.test(value);
}

function tavridaDetailBatches(fetched: SafeFetchResult, profile: SourceProfile) {
  const rawTitle = metaContent(fetched.body, "og:title") ?? textByClass(fetched.body, "name", 180) ?? pageTitle(fetched.body);
  const title = rawTitle?.replace(/\s*[-—|]\s*Новости\s+[«\"].*$/i, "").trim() ?? null;
  if (!title || title.length < 3) return [];
  const description = articleTextFromHtml(fetched.body)
    ?? metaContent(fetched.body, "og:description")
    ?? metaContent(fetched.body, "description");
  const published = textByClass(fetched.body, "date", 120);
  const eventInterval = description
    ? extractRussianEventInterval(description, yearFromText(published))
    : null;
  const isEvent = Boolean(eventInterval && hasFutureEventLanguage(`${title}\n${description ?? ""}`));
  const sourceText = [title, description, published, eventInterval?.excerpt].filter(Boolean).join("\n");
  const priceText = description?.match(/\b\d[\d\s]*(?:₽|руб(?:\.|лей)?)/i)?.[0]?.replace(/\s+/g, " ") ?? null;
  const batch = createClosedPublicationBatch({
    sourceUrl: fetched.finalUrl,
    sourceText,
    profile,
    externalId: new URL(fetched.finalUrl).pathname.split("/").filter(Boolean).at(-1) ?? fetched.finalUrl,
    type: isEvent ? "event" : "news",
    title,
    description,
    sourcePublishedAt: toMoscowSourcePublishedAt(published),
    startsAt: isEvent ? eventInterval?.startsAt : null,
    endsAt: isEvent ? eventInterval?.endsAt : null,
    priceText,
    isFree: Boolean(description && /\bбесплатн\w*/i.test(description)),
    ageLimit: description?.match(/(?:^|\s)(\d{1,2}\+)(?:\s|[.,;)]|$)/)?.[1] ?? null,
    imageSourceUrl: imageFromHtml(fetched.body, fetched.finalUrl),
    evidence: [
      { field: "title", excerpt: title },
      ...(description ? [{ field: "description", excerpt: description.slice(0, 280) }] : []),
      ...(isEvent && eventInterval ? [{ field: "dates", excerpt: eventInterval.excerpt }] : [])
    ],
    warnings: [
      "Материал обогащён данными подробной страницы Тавриды и оставлен в закрытой очереди.",
      published ? `Дата исходного материала: ${published}.` : "Дата исходного материала не указана.",
      isEvent && !eventInterval?.exactTime
        ? "Источник указывает дни события без точного времени; использованы границы календарных дней."
        : null
    ].filter((value): value is string => Boolean(value))
  });
  return batch ? [batch] : [];
}

const tavridaAdapter: SourceAdapter = {
  id: "tavrida-news-v1",
  matches: (url) => (url.hostname === "tavrida.art" || url.hostname === "www.tavrida.art")
    && (url.pathname === "/" || url.pathname.startsWith("/news")),
  async extract(input, profile) {
    if (/^\/news\/[^/]+\/?$/.test(new URL(input.fetched.finalUrl).pathname)) {
      return tavridaDetailBatches(input.fetched, profile);
    }
    const cards = tavridaCardBatches(input.fetched, profile);
    return enrichDetailBatches(cards, profile, input.fetchDetail, tavridaDetailBatches);
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
  const description = articleTextFromHtml(fetched.body, 4000)
    ?? metaContent(fetched.body, "description")
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
  const description = articleTextFromHtml(fetched.body, 4000)
    ?? metaContent(fetched.body, "og:description")
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
  const description = articleTextFromHtml(fetched.body)
    ?? metaContent(fetched.body, "og:description")
    ?? metaContent(fetched.body, "description")
    ?? fetched.text.slice(0, 1200);
  const published = metaContent(fetched.body, "article:published_time");
  const semanticInterval = semanticEventIntervalFromHtml(fetched.body);
  const textInterval = extractRussianEventInterval(description, yearFromText(published));
  const isEvent = Boolean(semanticInterval || (textInterval && hasFutureEventLanguage(`${title}\n${description}`)));
  const eventInterval = semanticInterval ?? textInterval;
  const sourceText = [title, description, fetched.text].filter(Boolean).join("\n");
  const batch = createClosedPublicationBatch({
    sourceUrl: fetched.finalUrl,
    sourceText,
    profile,
    externalId: fetched.finalUrl,
    type: isEvent ? "event" : "news",
    title,
    description,
    sourcePublishedAt: toMoscowSourcePublishedAt(published),
    startsAt: isEvent ? eventInterval?.startsAt : null,
    endsAt: isEvent ? eventInterval?.endsAt : null,
    imageSourceUrl: imageFromHtml(fetched.body, fetched.finalUrl),
    evidence: [
      { field: "title", excerpt: title },
      { field: "description", excerpt: description.slice(0, 280) },
      ...(isEvent && textInterval ? [{ field: "dates", excerpt: textInterval.excerpt }] : [])
    ],
    warnings: [
      "Для источника нет утверждённого адаптера; материал оставлен в закрытой очереди.",
      "Codex должен проверить источник и подготовить отдельный адаптер перед регулярным импортом.",
      isEvent && !semanticInterval
        ? "Источник указывает дни события без точного времени; использованы границы календарных дней."
        : null
    ].filter((value): value is string => Boolean(value))
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

  const adapter = adapters.find((item) => item.matches(url));
  if (adapter) {
    return {
      adapterId: adapter.id,
      format: "adapter",
      batches: await adapter.extract({ fetched, sourceKind, sourceName, fetchDetail }, profile)
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

  return {
    adapterId: "unknown-html-v1",
    format: "unknown",
    batches: unknownHtmlBatch(fetched, profile)
  };
}

export const officialSourceAdapterIds = adapters.map((adapter) => adapter.id);
