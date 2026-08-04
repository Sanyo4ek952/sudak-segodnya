import {
  extractedCandidateSchema,
  type ContentCandidateEvidence,
  type ExtractedCandidate,
  type PublicationCandidatePayload
} from "@/features/content-ingestion/model/contracts";
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

export function toMoscowOffsetIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized}T00:00:00+03:00`;
  const withZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}+03:00`;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) return null;
  const moscow = new Date(parsed.getTime() + 3 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${moscow.getUTCFullYear()}-${pad(moscow.getUTCMonth() + 1)}-${pad(moscow.getUTCDate())}`
    + `T${pad(moscow.getUTCHours())}:${pad(moscow.getUTCMinutes())}:${pad(moscow.getUTCSeconds())}+03:00`;
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

  const candidate = extractedCandidateSchema.parse({
    action: "create_publication",
    externalId: compact(input.externalId, 500),
    payload: {
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
      place: compact(input.place, 300),
      priceText: compact(input.priceText, 120),
      isFree: input.isFree ?? false,
      ageLimit: compact(input.ageLimit, 40),
      contactPhone: compact(input.contactPhone, 80),
      scheduleEntries: input.scheduleEntries ?? [],
      imageSourceUrl: resolveHttpsUrl(input.imageSourceUrl, sourceUrl)
    },
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
      contactLinks: contactUrl ? [{ label: "Сайт", href: contactUrl }] : []
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

function imageUrl(node: Record<string, unknown>, baseUrl: string) {
  const image = node.image;
  if (typeof image === "string") return resolveHttpsUrl(image, baseUrl);
  if (Array.isArray(image)) return imageUrl({ image: image[0] }, baseUrl);
  if (image && typeof image === "object") {
    const record = image as Record<string, unknown>;
    return resolveHttpsUrl(stringValue(record.url) ?? stringValue(record.contentUrl), baseUrl);
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
    validUntil: toMoscowOffsetIso(record.validThrough ?? record.priceValidUntil)
  };
}

function eventBatch(node: Record<string, unknown>, baseUrl: string, profile: SourceProfile): SourceCandidateBatch | null {
  const sourceUrl = itemUrl(node, baseUrl);
  const title = stringValue(node.name) ?? stringValue(node.headline);
  if (!title) return null;
  const description = stringValue(node.description) ?? stringValue(node.text);
  const startsAt = toMoscowOffsetIso(node.startDate);
  const endsAt = toMoscowOffsetIso(node.endDate);
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
    place,
    priceText: offer.priceText,
    isFree: offer.isFree,
    ageLimit: stringValue(node.typicalAgeRange),
    imageSourceUrl: imageUrl(node, sourceUrl),
    organizationName,
    warnings: [
      "Событие извлечено из JSON-LD и остаётся в закрытой очереди до проверки.",
      startsAt ? null : "JSON-LD не содержит однозначного времени начала.",
      endsAt ? null : "JSON-LD не содержит однозначного времени окончания."
    ].filter((value): value is string => Boolean(value))
  });
}

function articleBatch(node: Record<string, unknown>, baseUrl: string, profile: SourceProfile): SourceCandidateBatch | null {
  const sourceUrl = itemUrl(node, baseUrl);
  const title = stringValue(node.headline) ?? stringValue(node.name);
  if (!title) return null;
  const description = stringValue(node.description) ?? stringValue(node.articleBody);
  const published = stringValue(node.datePublished);
  const sourceText = [title, description, published].filter(Boolean).join("\n");
  return createClosedPublicationBatch({
    sourceUrl,
    sourceText,
    profile,
    externalId: stringValue(node["@id"]) ?? sourceUrl,
    type: "news",
    title,
    description,
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
    priceText: offer.priceText,
    isFree: offer.isFree,
    organizationName: organizationNameValue(node.seller, profile.organizationName),
    warnings: ["Предложение извлечено из JSON-LD и требует ручной проверки условий."]
  });
}

function unknownJsonLdBatch(node: Record<string, unknown>, baseUrl: string, profile: SourceProfile) {
  const types = jsonLdTypes(node);
  if (types.some((type) => ignoredJsonLdTypes.has(type))) return null;
  const title = stringValue(node.headline) ?? stringValue(node.name);
  const description = stringValue(node.description) ?? stringValue(node.text);
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
  const media = entry.match(/<(?:media:content|enclosure)\b([^>]*)\/?\s*>/i);
  if (!media?.[1]) return null;
  const type = attributeValue(media[1], "type");
  if (type && !type.toLocaleLowerCase("en-US").startsWith("image/")) return null;
  return resolveHttpsUrl(attributeValue(media[1], "url"), itemUrl);
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
