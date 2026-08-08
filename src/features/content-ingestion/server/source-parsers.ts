import {
  extractedCandidateSchema,
  type ContentCandidateEvidence,
  type ExtractedCandidate,
  type PublicationCandidatePayload
} from "@/features/content-ingestion/model/contracts";
import { applyImportedNewsValidity } from "@/features/content-ingestion/model/candidate-rules";
import { sanitizeSourceText } from "@/features/content-ingestion/server/secure-fetch";

export type SourceProfile = {
  organizationName: string;
  categorySlug: "kids" | "food" | "culture" | "sport" | "excursions" | "rental" | "shops" | "services";
  organizationTypeSlug: "food" | "delivery" | "kids" | "culture" | "excursions" | "rental_entertainment" | "shops" | "services" | "administration";
};

export type SourceCandidateBatch = {
  sourceUrl: string;
  sourceText: string;
  candidates: ExtractedCandidate[];
};

type PublicationBatchInput = {
  sourceUrl: string;
  sourceText: string;
  profile: SourceProfile;
  externalId?: string | null;
  type?: PublicationCandidatePayload["type"];
  title: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  validUntil?: string | null;
  sourcePublishedAt?: string | null;
  place?: string | null;
  priceText?: string | null;
  isFree?: boolean;
  ageLimit?: string | null;
  contactPhone?: string | null;
  imageSourceUrl?: string | null;
  organizationName?: string | null;
  scheduleEntries?: PublicationCandidatePayload["scheduleEntries"];
  evidence?: Array<{ field: string; excerpt: string }>;
  warnings?: string[];
};

const ignoredJsonLdTypes = new Set([
  "breadcrumblist",
  "imageobject",
  "itemlist",
  "listitem",
  "person",
  "postaladdress",
  "searchaction",
  "website"
]);

function compact(value: string | null | undefined, maximum: number) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized ? normalized.slice(0, maximum) : null;
}

export function decodeMarkupEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    laquo: "«",
    lt: "<",
    nbsp: " ",
    quot: '"',
    raquo: "»"
  };
  return value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, "$1")
    .replace(/&#(x?[0-9a-f]+);/gi, (_match, code: string) => {
      const radix = code[0]?.toLocaleLowerCase("en-US") === "x" ? 16 : 10;
      const value = Number.parseInt(radix === 16 ? code.slice(1) : code, radix);
      return Number.isFinite(value) ? String.fromCodePoint(value) : " ";
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLocaleLowerCase("en-US")] ?? match);
}

export function cleanMarkup(value: string, maximum = 4000) {
  return compact(sanitizeSourceText(decodeMarkupEntities(value), maximum), maximum);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagValue(source: string, names: string[]) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = source.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match?.[1]) return match[1];
  }
  return null;
}

function attributeValue(source: string, attribute: string) {
  const match = source.match(new RegExp(`\\b${escapeRegExp(attribute)}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function resolveHttpsUrl(value: string | null | undefined, baseUrl: string) {
  if (!value) return null;
  try {
    const resolved = new URL(decodeMarkupEntities(value), baseUrl);
    if (resolved.protocol !== "https:") return null;
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

export function toMoscowOffsetIso(value: unknown, endOfDay = false) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T${endOfDay ? "23:59:59" : "00:00:00"}+03:00`;
  }
  const hasExplicitZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(normalized)
    || /\b(?:GMT|UTC)\b/i.test(normalized);
  const withZone = hasExplicitZone ? normalized : `${normalized}+03:00`;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) return null;
  const moscow = new Date(parsed.getTime() + 3 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${moscow.getUTCFullYear()}-${pad(moscow.getUTCMonth() + 1)}-${pad(moscow.getUTCDate())}`
    + `T${pad(moscow.getUTCHours())}:${pad(moscow.getUTCMinutes())}:${pad(moscow.getUTCSeconds())}+03:00`;
}

const russianMonthNumbers: Record<string, number> = {
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

const russianMonthPattern = Object.keys(russianMonthNumbers).join("|");

export type RussianEventInterval = {
  startsAt: string;
  endsAt: string;
  excerpt: string;
  exactTime: boolean;
};

function validCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function localDateTime(year: number, month: number, day: number, time: string) {
  if (!validCalendarDate(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}+03:00`;
}

export function toMoscowSourcePublishedAt(value: unknown) {
  const parsedStandard = toMoscowOffsetIso(value);
  if (parsedStandard || typeof value !== "string") return parsedStandard;
  const match = new RegExp(
    `\\b(\\d{1,2})\\s+(${russianMonthPattern})\\s+(20\\d{2})(?:\\s*(?:года?|г\\.))?(?:\\s+в\\s+(\\d{1,2})(?::(\\d{2}))?)?`,
    "i"
  ).exec(value.normalize("NFKC").replace(/\u00a0/g, " "));
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const month = russianMonthNumbers[match[2].toLocaleLowerCase("ru-RU")];
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  if (!month || hour > 23 || minute > 59) return null;
  return localDateTime(
    Number(match[3]),
    month,
    Number(match[1]),
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
  );
}

function intervalResult({
  startYear,
  startMonth,
  startDay,
  endYear,
  endMonth,
  endDay,
  excerpt,
  startTime = "00:00:00"
}: {
  startYear: number;
  startMonth: number;
  startDay: number;
  endYear: number;
  endMonth: number;
  endDay: number;
  excerpt: string;
  startTime?: string;
}): RussianEventInterval | null {
  const startsAt = localDateTime(startYear, startMonth, startDay, startTime);
  const endsAt = localDateTime(endYear, endMonth, endDay, "23:59:59");
  if (!startsAt || !endsAt || Date.parse(endsAt) < Date.parse(startsAt)) return null;
  return {
    startsAt,
    endsAt,
    excerpt: excerpt.replace(/\s+/g, " ").trim().slice(0, 300),
    exactTime: false
  };
}

export function extractRussianEventInterval(value: string, fallbackYear?: number | null) {
  const normalized = value.normalize("NFKC").replace(/\u00a0/g, " ");
  const crossMonth = new RegExp(
    `(?:с\\s+)?(\\d{1,2})\\s+(${russianMonthPattern})(?:\\s+(20\\d{2})(?:\\s*(?:года?|г\\.))?)?\\s+(?:по|до|[-–—])\\s+(\\d{1,2})\\s+(${russianMonthPattern})(?:\\s+(20\\d{2})(?:\\s*(?:года?|г\\.))?)?`,
    "i"
  ).exec(normalized);
  if (crossMonth?.[1] && crossMonth[2] && crossMonth[4] && crossMonth[5]) {
    const startMonth = russianMonthNumbers[crossMonth[2].toLocaleLowerCase("ru-RU")];
    const endMonth = russianMonthNumbers[crossMonth[5].toLocaleLowerCase("ru-RU")];
    const explicitStartYear = Number(crossMonth[3] ?? 0) || null;
    const explicitEndYear = Number(crossMonth[6] ?? 0) || null;
    const baseYear = explicitEndYear ?? explicitStartYear ?? fallbackYear ?? null;
    if (startMonth && endMonth && baseYear) {
      const startYear = explicitStartYear ?? (startMonth > endMonth ? baseYear - 1 : baseYear);
      const endYear = explicitEndYear ?? (endMonth < startMonth ? startYear + 1 : startYear);
      const interval = intervalResult({
        startYear,
        startMonth,
        startDay: Number(crossMonth[1]),
        endYear,
        endMonth,
        endDay: Number(crossMonth[4]),
        excerpt: crossMonth[0]
      });
      if (interval) return interval;
    }
  }

  const sameMonth = new RegExp(
    `(?:с\\s+)?(\\d{1,2})\\s*(?:по|до|[-–—])\\s*(\\d{1,2})\\s+(${russianMonthPattern})(?:\\s+(20\\d{2})(?:\\s*(?:года?|г\\.))?)?`,
    "i"
  ).exec(normalized);
  if (sameMonth?.[1] && sameMonth[2] && sameMonth[3]) {
    const month = russianMonthNumbers[sameMonth[3].toLocaleLowerCase("ru-RU")];
    const year = Number(sameMonth[4] ?? 0) || fallbackYear || null;
    if (month && year) {
      const interval = intervalResult({
        startYear: year,
        startMonth: month,
        startDay: Number(sameMonth[1]),
        endYear: year,
        endMonth: month,
        endDay: Number(sameMonth[2]),
        excerpt: sameMonth[0]
      });
      if (interval) return interval;
    }
  }

  const singleDate = new RegExp(
    `\\b(\\d{1,2})\\s+(${russianMonthPattern})(?:\\s+(20\\d{2})(?:\\s*(?:года?|г\\.))?)?(?:\\s+в\\s+(\\d{1,2})(?::(\\d{2}))?)?`,
    "gi"
  );
  const eventCue = /(?:пройд[её]т|состоится|начн[её]тся|будет\s+проходить)/i;
  for (const match of Array.from(normalized.matchAll(singleDate))) {
    if (!match[1] || !match[2]) continue;
    const start = match.index ?? 0;
    const context = normalized.slice(Math.max(0, start - 90), Math.min(normalized.length, start + match[0].length + 90));
    if (!eventCue.test(context)) continue;
    const month = russianMonthNumbers[match[2].toLocaleLowerCase("ru-RU")];
    const year = Number(match[3] ?? 0) || fallbackYear || null;
    const hour = Number(match[4] ?? 0);
    const minute = Number(match[5] ?? 0);
    if (!month || !year || hour > 23 || minute > 59) continue;
    const interval = intervalResult({
      startYear: year,
      startMonth: month,
      startDay: Number(match[1]),
      endYear: year,
      endMonth: month,
      endDay: Number(match[1]),
      excerpt: match[0],
      startTime: match[4]
        ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
        : "00:00:00"
    });
    if (interval) return interval;
  }
  return null;
}

function safeSourceUrl(value: string, fallback: string) {
  return resolveHttpsUrl(value, fallback) ?? fallback;
}

function uniqueWarnings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

export function createClosedPublicationBatch(input: PublicationBatchInput): SourceCandidateBatch | null {
  const title = compact(input.title, 180);
  if (!title || title.length < 3) return null;
  const sourceUrl = safeSourceUrl(input.sourceUrl, input.sourceUrl);
  const description = compact(input.description, 4000);
  const evidence: ContentCandidateEvidence[] = [];
  for (const item of input.evidence ?? [
    { field: "title", excerpt: title },
    ...(description ? [{ field: "description", excerpt: description.slice(0, 280) }] : [])
  ]) {
    const excerpt = compact(item.excerpt, 300);
    if (excerpt && input.sourceText.normalize("NFKC").toLocaleLowerCase("ru-RU")
      .includes(excerpt.normalize("NFKC").toLocaleLowerCase("ru-RU"))) {
      evidence.push({ field: item.field.slice(0, 80), excerpt, sourceUrl });
    }
  }

  const payload = applyImportedNewsValidity({
    kind: "publication",
    organizationId: null,
    organizationName: compact(input.organizationName, 180) ?? input.profile.organizationName,
    targetPublicationId: null,
    type: input.type ?? "news",
    title,
    description,
    categorySlug: input.profile.categorySlug,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    validUntil: input.validUntil ?? null,
    sourcePublishedAt: input.sourcePublishedAt ?? null,
    place: compact(input.place, 300),
    priceText: compact(input.priceText, 120),
    isFree: input.isFree ?? false,
    ageLimit: compact(input.ageLimit, 40),
    contactPhone: compact(input.contactPhone, 80),
    scheduleEntries: input.scheduleEntries ?? [],
    imageSourceUrl: resolveHttpsUrl(input.imageSourceUrl, sourceUrl)
  });
  const candidate = extractedCandidateSchema.parse({
    action: "create_publication",
    externalId: compact(input.externalId, 500),
    payload,
    evidence,
    warnings: uniqueWarnings([
      ...(input.warnings ?? []),
      evidence.length === 0 ? "Структурированное доказательство не найдено в исходном материале." : null
    ])
  });

  return { sourceUrl, sourceText: input.sourceText.slice(0, 60_000), candidates: [candidate] };
}

function createOrganizationBatch({
  sourceUrl,
  sourceText,
  externalId,
  profile,
  node
}: {
  sourceUrl: string;
  sourceText: string;
  externalId: string | null;
  profile: SourceProfile;
  node: Record<string, unknown>;
}): SourceCandidateBatch | null {
  const name = compact(stringValue(node.name), 160);
  if (!name || name.length < 2) return null;
  const description = compact(stringValue(node.description), 4000);
  const address = compact(addressValue(node.address), 500);
  const phone = compact(stringValue(node.telephone), 80);
  const workingHours = compact(stringValue(node.openingHours), 1000);
  const nodeUrl = safeSourceUrl(stringValue(node.url) ?? sourceUrl, sourceUrl);
  const evidenceValues = [name, description?.slice(0, 280), address, phone].filter((value): value is string => Boolean(value));
  const text = [sourceText, ...evidenceValues].join("\n");
  const evidence = evidenceValues.slice(0, 4).map((excerpt, index) => ({
    field: ["name", "description", "address", "phone"][index] ?? "organization",
    excerpt: excerpt.slice(0, 300),
    sourceUrl: nodeUrl
  }));
  const contactUrl = resolveHttpsUrl(stringValue(node.url), nodeUrl);
  const candidate = extractedCandidateSchema.parse({
    action: "create_organization",
    externalId,
    payload: {
      kind: "organization",
      name,
      typeSlug: organizationTypeFromJsonLd(node, profile),
      description,
      address,
      phone,
      workingHours,
      contactLinks: contactUrl ? [{ label: "Сайт", href: contactUrl }] : [],
      imageSourceUrl: imageUrl(node, nodeUrl)
    },
    evidence,
    warnings: ["Организация извлечена из JSON-LD и остаётся в закрытой очереди до проверки администратором."]
  });
  return { sourceUrl: nodeUrl, sourceText: text.slice(0, 60_000), candidates: [candidate] };
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") return cleanMarkup(value, 4000);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return compact(value.map(stringValue).filter(Boolean).join(", "), 4000);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return stringValue(record.name ?? record.text ?? record.value);
  }
  return null;
}

function richestText(...values: unknown[]) {
  return values
    .map(stringValue)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length)[0] ?? null;
}

function addressValue(value: unknown) {
  if (typeof value === "string") return cleanMarkup(value, 500);
  if (!value || typeof value !== "object") return null;
  const address = value as Record<string, unknown>;
  return compact([
    stringValue(address.addressRegion),
    stringValue(address.addressLocality),
    stringValue(address.streetAddress)
  ].filter(Boolean).join(", "), 500);
}

function jsonLdTypes(node: Record<string, unknown>) {
  const value = node["@type"];
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is string => typeof item === "string")
    .map((item) => item.toLocaleLowerCase("en-US"));
}

function isJsonLdType(node: Record<string, unknown>, ...types: string[]) {
  const actual = jsonLdTypes(node);
  return types.some((type) => actual.includes(type.toLocaleLowerCase("en-US")));
}

function organizationTypeFromJsonLd(node: Record<string, unknown>, profile: SourceProfile) {
  if (isJsonLdType(node, "Restaurant", "FoodEstablishment")) return "food";
  if (isJsonLdType(node, "Museum", "Library", "PerformingArtsTheater")) return "culture";
  if (isJsonLdType(node, "GovernmentOrganization")) return "administration";
  return profile.organizationTypeSlug;
}

function itemUrl(node: Record<string, unknown>, baseUrl: string) {
  const id = stringValue(node.url) ?? stringValue(node["@id"]);
  return safeSourceUrl(id ?? baseUrl, baseUrl);
}

function imageValueUrl(image: unknown, baseUrl: string): string | null {
  if (typeof image === "string") return resolveHttpsUrl(image, baseUrl);
  if (Array.isArray(image)) {
    for (const item of image) {
      const resolved = imageValueUrl(item, baseUrl);
      if (resolved) return resolved;
    }
    return null;
  }
  if (image && typeof image === "object") {
    const record = image as Record<string, unknown>;
    for (const value of [record.contentUrl, record.url, record.thumbnailUrl, record["@id"]]) {
      const resolved = imageValueUrl(value, baseUrl);
      if (resolved) return resolved;
    }
  }
  return null;
}

function imageUrl(node: Record<string, unknown>, baseUrl: string) {
  for (const value of [
    node.image,
    node.primaryImageOfPage,
    node.thumbnailUrl,
    node.thumbnail,
    node.associatedMedia
  ]) {
    const resolved = imageValueUrl(value, baseUrl);
    if (resolved) return resolved;
  }
  return null;
}

function locationValue(value: unknown) {
  if (typeof value === "string") return cleanMarkup(value, 300);
  if (!value || typeof value !== "object") return null;
  const location = value as Record<string, unknown>;
  return compact([stringValue(location.name), addressValue(location.address)].filter(Boolean).join(", "), 300);
}

function organizationNameValue(value: unknown, fallback: string) {
  if (typeof value === "string") return compact(value, 180) ?? fallback;
  if (value && typeof value === "object") {
    return compact(stringValue((value as Record<string, unknown>).name), 180) ?? fallback;
  }
  return fallback;
}

function offerFacts(value: unknown) {
  const offer = Array.isArray(value) ? value[0] : value;
  if (!offer || typeof offer !== "object") return { priceText: null, isFree: false, validUntil: null };
  const record = offer as Record<string, unknown>;
  const price = stringValue(record.price)
    ?? (record.priceSpecification && typeof record.priceSpecification === "object"
      ? stringValue((record.priceSpecification as Record<string, unknown>).price)
      : null);
  const currency = stringValue(record.priceCurrency)
    ?? (record.priceSpecification && typeof record.priceSpecification === "object"
      ? stringValue((record.priceSpecification as Record<string, unknown>).priceCurrency)
      : null);
  const numericPrice = price ? Number(price.replace(",", ".")) : Number.NaN;
  return {
    priceText: price ? `${price}${currency === "RUB" ? " ₽" : currency ? ` ${currency}` : ""}` : null,
    isFree: Number.isFinite(numericPrice) && numericPrice === 0,
    validUntil: toMoscowOffsetIso(record.validThrough ?? record.priceValidUntil, true)
  };
}

function eventBatch(node: Record<string, unknown>, baseUrl: string, profile: SourceProfile): SourceCandidateBatch | null {
  const sourceUrl = itemUrl(node, baseUrl);
  const title = stringValue(node.name) ?? stringValue(node.headline);
  if (!title) return null;
  const description = richestText(node.description, node.text);
  const rawStart = stringValue(node.startDate);
  const rawEnd = stringValue(node.endDate);
  const startsAt = toMoscowOffsetIso(rawStart);
  const endsAt = rawEnd
    ? toMoscowOffsetIso(rawEnd, true)
    : rawStart && /^\d{4}-\d{2}-\d{2}$/.test(rawStart)
      ? toMoscowOffsetIso(rawStart, true)
      : null;
  const place = locationValue(node.location);
  const organizationName = organizationNameValue(node.organizer ?? node.location, profile.organizationName);
  const offer = offerFacts(node.offers);
  const sourceText = [title, description, stringValue(node.startDate), stringValue(node.endDate), place, offer.priceText]
    .filter(Boolean).join("\n");
  return createClosedPublicationBatch({
    sourceUrl,
    sourceText,
    profile,
    externalId: stringValue(node["@id"]) ?? sourceUrl,
    type: "event",
    title,
    description,
    startsAt,
    endsAt,
    sourcePublishedAt: toMoscowSourcePublishedAt(node.datePublished),
    place,
    priceText: offer.priceText,
    isFree: offer.isFree,
    ageLimit: stringValue(node.typicalAgeRange),
    imageSourceUrl: imageUrl(node, sourceUrl),
    organizationName,
    warnings: [
      "Событие извлечено из JSON-LD и остаётся в закрытой очереди до проверки.",
      startsAt ? null : "JSON-LD не содержит однозначного времени начала.",
      endsAt ? null : "JSON-LD не содержит однозначного времени окончания.",
      !rawEnd && endsAt ? "В источнике указана только дата события; окончанием выбран конец этого дня." : null
    ].filter((value): value is string => Boolean(value))
  });
}

function articleBatch(node: Record<string, unknown>, baseUrl: string, profile: SourceProfile): SourceCandidateBatch | null {
  const sourceUrl = itemUrl(node, baseUrl);
  const title = stringValue(node.headline) ?? stringValue(node.name);
  if (!title) return null;
  const description = richestText(node.articleBody, node.description, node.text);
  const published = stringValue(node.datePublished);
  const sourcePublishedAt = toMoscowSourcePublishedAt(published);
  const sourceText = [title, description, published].filter(Boolean).join("\n");
  return createClosedPublicationBatch({
    sourceUrl,
    sourceText,
    profile,
    externalId: stringValue(node["@id"]) ?? sourceUrl,
    type: "news",
    title,
    description,
    sourcePublishedAt,
    imageSourceUrl: imageUrl(node, sourceUrl),
    organizationName: organizationNameValue(node.publisher, profile.organizationName),
    warnings: [
      "Новость извлечена из JSON-LD и остаётся в закрытой очереди до проверки актуальности.",
      published ? `Дата исходного материала: ${published}.` : "Дата исходного материала не указана."
    ]
  });
}

function offerBatch(node: Record<string, unknown>, baseUrl: string, profile: SourceProfile): SourceCandidateBatch | null {
  const sourceUrl = itemUrl(node, baseUrl);
  const title = stringValue(node.name) ?? stringValue(node.description);
  if (!title) return null;
  const description = stringValue(node.description);
  const offer = offerFacts(node);
  const sourceText = [title, description, offer.priceText, stringValue(node.validThrough)].filter(Boolean).join("\n");
  return createClosedPublicationBatch({
    sourceUrl,
    sourceText,
    profile,
    externalId: stringValue(node["@id"]) ?? sourceUrl,
    type: "promo",
    title,
    description,
    validUntil: offer.validUntil,
    sourcePublishedAt: toMoscowSourcePublishedAt(node.datePublished),
    priceText: offer.priceText,
    isFree: offer.isFree,
    imageSourceUrl: imageUrl(node, sourceUrl),
    organizationName: organizationNameValue(node.seller, profile.organizationName),
    warnings: ["Предложение извлечено из JSON-LD и требует ручной проверки условий."]
  });
}

function unknownJsonLdBatch(node: Record<string, unknown>, baseUrl: string, profile: SourceProfile) {
  const types = jsonLdTypes(node);
  if (types.some((type) => ignoredJsonLdTypes.has(type))) return null;
  const title = stringValue(node.headline) ?? stringValue(node.name);
  const description = richestText(node.articleBody, node.description, node.text);
  if (!title || !description) return null;
  const sourceUrl = itemUrl(node, baseUrl);
  const sourceText = [title, description].join("\n");
  return createClosedPublicationBatch({
    sourceUrl,
    sourceText,
    profile,
    externalId: stringValue(node["@id"]) ?? sourceUrl,
    title,
    description,
    sourcePublishedAt: toMoscowSourcePublishedAt(node.datePublished),
    imageSourceUrl: imageUrl(node, sourceUrl),
    organizationName: organizationNameValue(node.publisher, profile.organizationName),
    warnings: [
      `Неизвестный тип JSON-LD (${types.join(", ") || "не указан"}); материал оставлен в закрытой очереди.`,
      "Перед одобрением выберите тип публикации и срок актуальности."
    ]
  });
}

function collectJsonLdNodes(value: unknown, result: Record<string, unknown>[]) {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdNodes(item, result);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record["@graph"])) collectJsonLdNodes(record["@graph"], result);
  if (record["@type"]) result.push(record);
}

export function parseJsonLdCandidateBatches(html: string, baseUrl: string, profile: SourceProfile) {
  const batches: SourceCandidateBatch[] = [];
  const scripts = html.matchAll(/<script\b[^>]*type\s*=\s*["'][^"']*ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of Array.from(scripts)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeMarkupEntities(match[1] ?? "").trim());
    } catch {
      continue;
    }
    const nodes: Record<string, unknown>[] = [];
    collectJsonLdNodes(parsed, nodes);
    for (const node of nodes) {
      const nodeUrl = itemUrl(node, baseUrl);
      const sourceText = [stringValue(node.name), stringValue(node.description), stringValue(node.text)]
        .filter(Boolean).join("\n");
      const batch = isJsonLdType(node, "Event")
        ? eventBatch(node, baseUrl, profile)
        : isJsonLdType(node, "NewsArticle", "Article", "BlogPosting")
          ? articleBatch(node, baseUrl, profile)
          : isJsonLdType(node, "Offer")
            ? offerBatch(node, baseUrl, profile)
            : isJsonLdType(
              node,
              "Organization",
              "LocalBusiness",
              "GovernmentOrganization",
              "Museum",
              "Library",
              "Restaurant",
              "FoodEstablishment",
              "PerformingArtsTheater"
            )
              ? createOrganizationBatch({
                sourceUrl: nodeUrl,
                sourceText,
                externalId: stringValue(node["@id"]) ?? nodeUrl,
                profile,
                node
              })
              : unknownJsonLdBatch(node, baseUrl, profile);
      if (batch) batches.push(batch);
    }
  }
  return batches.slice(0, 20);
}

function rssEntryUrl(entry: string, feedUrl: string, atom: boolean) {
  if (!atom) return resolveHttpsUrl(cleanMarkup(tagValue(entry, ["link"]) ?? "", 1000), feedUrl) ?? feedUrl;
  const alternate = Array.from(entry.matchAll(/<link\b([^>]*)\/?\s*>/gi))
    .find((match) => !/\brel\s*=\s*["'](?:self|enclosure)["']/i.test(match[1] ?? ""));
  return resolveHttpsUrl(attributeValue(alternate?.[1] ?? "", "href"), feedUrl) ?? feedUrl;
}

function rssImageUrl(entry: string, itemUrl: string) {
  for (const media of Array.from(entry.matchAll(
    /<(?:media:content|media:thumbnail|enclosure|itunes:image)\b([^>]*)\/?\s*>/gi
  ))) {
    const attributes = media[1] ?? "";
    const type = attributeValue(attributes, "type");
    if (type && !type.toLocaleLowerCase("en-US").startsWith("image/")) continue;
    const resolved = resolveHttpsUrl(
      attributeValue(attributes, "url") ?? attributeValue(attributes, "href"),
      itemUrl
    );
    if (resolved) return resolved;
  }

  const nestedImage = tagValue(entry, ["image"]);
  const nestedUrl = nestedImage ? tagValue(nestedImage, ["url"]) : null;
  const resolvedNested = resolveHttpsUrl(cleanMarkup(nestedUrl ?? "", 1000), itemUrl);
  if (resolvedNested) return resolvedNested;

  const markup = decodeMarkupEntities(
    tagValue(entry, ["content:encoded", "description", "summary", "content"]) ?? ""
  );
  const imageTag = markup.match(/<img\b([^>]*)>/i)?.[1] ?? "";
  return resolveHttpsUrl(
    attributeValue(imageTag, "src") ?? attributeValue(imageTag, "data-src"),
    itemUrl
  );
}

export function parseRssCandidateBatches(xml: string, feedUrl: string, profile: SourceProfile) {
  const rssEntries = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi));
  const atomEntries = rssEntries.length === 0
    ? Array.from(xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi))
    : [];
  const atom = rssEntries.length === 0;
  const entries = atom ? atomEntries : rssEntries;
  const batches: SourceCandidateBatch[] = [];
  for (const match of entries.slice(0, 20)) {
    const entry = match[1] ?? "";
    const title = cleanMarkup(tagValue(entry, ["title"]) ?? "", 180);
    if (!title || title.length < 3) continue;
    const itemUrl = rssEntryUrl(entry, feedUrl, atom);
    const description = cleanMarkup(
      tagValue(entry, ["content:encoded", "description", "summary", "content"]) ?? "",
      4000
    );
    const published = cleanMarkup(tagValue(entry, ["pubDate", "published", "updated", "dc:date"]) ?? "", 120);
    const sourcePublishedAt = toMoscowSourcePublishedAt(published);
    const externalId = cleanMarkup(tagValue(entry, ["guid", "id"]) ?? "", 500) ?? itemUrl;
    const sourceText = [title, description, published, itemUrl].filter(Boolean).join("\n");
    const batch = createClosedPublicationBatch({
      sourceUrl: itemUrl,
      sourceText,
      profile,
      externalId,
      type: "news",
      title,
      description,
      sourcePublishedAt,
      imageSourceUrl: rssImageUrl(entry, itemUrl),
      warnings: [
        "RSS/Atom-материал оставлен в закрытой очереди до проверки типа и актуальности.",
        published ? `Дата исходного материала: ${published}.` : "Дата исходного материала в ленте не указана."
      ]
    });
    if (batch) batches.push(batch);
  }
  return batches;
}

export function looksLikeRss(body: string, contentType: string) {
  return /(?:rss|atom)\+xml/i.test(contentType)
    || /^\s*<\?xml[\s\S]{0,500}<(?:rss|feed)\b/i.test(body)
    || /^\s*<(?:rss|feed)\b/i.test(body);
}
