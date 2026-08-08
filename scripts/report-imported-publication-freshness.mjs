import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const newsFreshnessMilliseconds = 7 * 24 * 60 * 60 * 1000;
const russianMonths = new Map([
  ["января", 0], ["февраля", 1], ["марта", 2], ["апреля", 3],
  ["мая", 4], ["июня", 5], ["июля", 6], ["августа", 7],
  ["сентября", 8], ["октября", 9], ["ноября", 10], ["декабря", 11]
]);

function sourcePublishedAtFromWarnings(warnings) {
  if (!Array.isArray(warnings)) return null;
  const warning = warnings.find((value) => (
    typeof value === "string" && value.startsWith("Дата исходного материала:")
  ));
  if (!warning) return null;
  const raw = warning.slice("Дата исходного материала:".length).trim().replace(/\.$/, "");
  const standardTimestamp = Date.parse(raw);
  if (!Number.isNaN(standardTimestamp)) return new Date(standardTimestamp).toISOString();
  const match = raw.toLocaleLowerCase("ru-RU").match(
    /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(20\d{2})/
  );
  const month = match?.[2] ? russianMonths.get(match[2]) : undefined;
  if (!match?.[1] || !match[3] || month === undefined) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])) - 3 * 60 * 60 * 1000).toISOString();
}

function readLocalEnv() {
  try {
    return Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const separator = line.indexOf("=");
          return [
            line.slice(0, separator).trim(),
            line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2")
          ];
        })
    );
  } catch {
    return {};
  }
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl?.startsWith("https://") || !serviceRoleKey?.startsWith("sb_secret_")) {
  throw new Error("Для read-only отчёта нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const now = new Date();

const [publicationsResult, candidatesResult] = await Promise.all([
  supabase
    .from("publications")
    .select("id,client_request_id,title,type,status,ends_at,valid_until,published_at,organizations(name)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1000),
  supabase
    .from("content_candidates")
    .select("id,payload,warnings,source_url,result_publication_id")
    .not("result_publication_id", "is", null)
    .limit(1000)
]);

if (publicationsResult.error || candidatesResult.error) {
  throw new Error("Не удалось построить read-only отчёт по импортированным публикациям.");
}

const candidatesByPublication = new Map();
const candidatesById = new Map();
for (const candidate of candidatesResult.data ?? []) {
  candidatesById.set(candidate.id, candidate);
  if (candidate.result_publication_id) {
    candidatesByPublication.set(candidate.result_publication_id, candidate);
  }
}

const items = [];
for (const publication of publicationsResult.data ?? []) {
  const candidate = candidatesByPublication.get(publication.id)
    ?? (publication.client_request_id ? candidatesById.get(publication.client_request_id) : null);
  if (!candidate) continue;

  const sourcePublishedAt = typeof candidate.payload?.sourcePublishedAt === "string"
    ? candidate.payload.sourcePublishedAt
    : sourcePublishedAtFromWarnings(candidate.warnings);
  const sourceWindowEndsAt = sourcePublishedAt && !Number.isNaN(Date.parse(sourcePublishedAt))
    ? new Date(Date.parse(sourcePublishedAt) + newsFreshnessMilliseconds).toISOString()
    : null;
  const reasons = [];
  if (publication.type === "event") {
    if (publication.ends_at && Date.parse(publication.ends_at) <= now.getTime()) {
      reasons.push("мероприятие завершилось");
    }
  } else if (publication.valid_until && Date.parse(publication.valid_until) <= now.getTime()) {
    reasons.push("срок актуальности истёк");
  }
  if (publication.type === "news") {
    if (!sourcePublishedAt) reasons.push("в кандидате нет подтверждённой даты источника");
    if (sourceWindowEndsAt && Date.parse(sourceWindowEndsAt) <= now.getTime()) {
      reasons.push("семидневное окно новости истекло");
    }
  }

  items.push({
    publicationId: publication.id,
    title: publication.title,
    organization: publication.organizations?.name ?? null,
    type: publication.type,
    sourceUrl: candidate.source_url,
    sourcePublishedAt,
    sourceWindowEndsAt,
    endsAt: publication.ends_at,
    validUntil: publication.valid_until,
    publishedAt: publication.published_at,
    requiresReview: reasons.length > 0,
    reasons
  });
}

console.log(JSON.stringify({
  target: new URL(supabaseUrl).hostname,
  generatedAt: now.toISOString(),
  importedPublishedCount: items.length,
  requiresReviewCount: items.filter((item) => item.requiresReview).length,
  items
}, null, 2));
