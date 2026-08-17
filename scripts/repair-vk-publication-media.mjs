import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const publicationId = "b02729b7-ed98-4da4-842f-56c6cd04c07a";
const apply = process.argv.includes("--apply");

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

function required(name, value) {
  if (!value) throw new Error("Нужна server-side переменная " + name + ".");
  return value;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sourceUrlForResolver(value) {
  const source = new URL(value);
  const match = source.pathname.match(/^\/(video|clip)(-?[1-9][0-9]*)_([1-9][0-9]*)\/?$/i);
  if (!match) throw new Error("В исходном VK-вложении нет корректного ID видео.");
  source.protocol = "https:";
  source.hostname = "vk.com";
  source.pathname = "/" + match[1].toLowerCase() + match[2] + "_" + match[3];
  return source.toString();
}

function videoKind(item) {
  const attachments = Array.isArray(item.raw_payload?.attachments) ? item.raw_payload.attachments : [];
  const isClip = attachments.some((attachment) => (
    attachment && typeof attachment === "object" && (
      attachment.type === "clip"
      || attachment.video?.type === "short_video"
      || attachment.clip?.type === "short_video"
    )
  ));
  return isClip ? "clip" : "video";
}

function getVideoSource(item) {
  const media = Array.isArray(item.media) ? item.media : [];
  const sourceUrl = media.map((entry) => text(entry?.sourceUrl)).find(Boolean);
  if (!sourceUrl) throw new Error("В исходном VK-материале не найдена прямая ссылка на видео.");
  return sourceUrl;
}

async function resolveVkMedia({ supabaseUrl, anonKey, internalSecret, sourceUrl }) {
  const response = await fetch(supabaseUrl + "/functions/v1/vk-media-resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: "Bearer " + internalSecret
    },
    body: JSON.stringify({ urls: [sourceUrl] }),
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => null);
  const result = Array.isArray(payload?.results) ? payload.results[0] : null;
  if (!response.ok || result?.status !== "ready" || !result.media) {
    const reason = text(result?.error) ?? ("HTTP " + response.status);
    throw new Error("VK не вернул пригодный для встраивания плеер: " + reason);
  }
  const media = result.media;
  if (
    (media.kind !== "video" && media.kind !== "clip")
    || typeof media.embedUrl !== "string"
    || typeof media.sourceUrl !== "string"
    || typeof media.externalId !== "string"
  ) {
    throw new Error("VK resolver вернул некорректные метаданные видео.");
  }
  return media;
}

const localEnv = readLocalEnv();
const supabaseUrl = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL
);
const serviceRoleKey = required(
  "SUPABASE_SERVICE_ROLE_KEY",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY
);
const anonKey = required(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const internalSecret = required(
  "VK_IMPORT_INTERNAL_SECRET",
  process.env.VK_IMPORT_INTERNAL_SECRET ?? localEnv.VK_IMPORT_INTERNAL_SECRET
);
if (!supabaseUrl.startsWith("https://") || !serviceRoleKey.startsWith("sb_secret_")) {
  throw new Error("Repair выполняется только против защищённого Supabase-проекта.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: candidate, error: candidateError } = await supabase
  .from("content_candidates")
  .select("id, status, source_url")
  .eq("result_publication_id", publicationId)
  .eq("status", "approved")
  .maybeSingle();
if (candidateError || !candidate?.source_url) {
  throw new Error("Не найден одобренный VK-кандидат для восстановления публикации.");
}

const { data: externalItem, error: externalItemError } = await supabase
  .from("external_items")
  .select("id, media, raw_payload")
  .eq("source_url", candidate.source_url)
  .maybeSingle();
if (externalItemError || !externalItem) {
  throw new Error("Не найден сохранённый исходный материал VK.");
}

const kind = videoKind(externalItem);
const sourceUrl = sourceUrlForResolver(getVideoSource(externalItem));
const resolved = await resolveVkMedia({ supabaseUrl, anonKey, internalSecret, sourceUrl });

const { data: mediaRows, error: mediaError } = await supabase
  .from("publication_media")
  .select("id, kind, provider, source_url, embed_url, media_asset_id, sort_order")
  .eq("publication_id", publicationId)
  .order("sort_order")
  .limit(10);
if (mediaError) {
  throw new Error("Таблица publication_media недоступна: сначала примените миграции VK-медиагалереи.");
}
const mediaRow = (mediaRows ?? []).find((row) => row.sort_order === 0);
if (!mediaRow) throw new Error("У публикации нет медиа для восстановления.");

const { data: asset, error: assetError } = await supabase
  .from("media_assets")
  .select("id, purpose")
  .eq("id", mediaRow.media_asset_id)
  .eq("publication_id", publicationId)
  .maybeSingle();
if (assetError || !asset) throw new Error("Не найден сохранённый постер публикации.");

const alreadyRepaired = (
  mediaRow.kind === kind
  && mediaRow.provider === "vk"
  && mediaRow.source_url === resolved.sourceUrl
  && mediaRow.embed_url === resolved.embedUrl
  && asset.purpose === "publication_video_poster"
);
const summary = {
  target: new URL(supabaseUrl).hostname,
  publicationId,
  candidateId: candidate.id,
  sourceUrl: resolved.sourceUrl,
  kind,
  mediaRowId: mediaRow.id,
  dryRun: !apply,
  alreadyRepaired
};

if (!apply || alreadyRepaired) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

if (asset.purpose !== "publication_video_poster") {
  const { error } = await supabase
    .from("media_assets")
    .update({ purpose: "publication_video_poster" })
    .eq("id", asset.id)
    .eq("publication_id", publicationId);
  if (error) throw new Error("Не удалось пометить постер как постер VK-видео.");
}

const { error: updateError } = await supabase
  .from("publication_media")
  .update({
    kind,
    provider: "vk",
    external_id: resolved.externalId,
    source_url: resolved.sourceUrl,
    embed_url: resolved.embedUrl,
    title: resolved.title,
    duration_seconds: resolved.durationSeconds,
    width: resolved.width,
    height: resolved.height
  })
  .eq("id", mediaRow.id)
  .eq("publication_id", publicationId);
if (updateError) {
  throw new Error("Не удалось связать постер с VK-плеером. Повторный запуск безопасен.");
}

console.log(JSON.stringify({ ...summary, dryRun: false, repaired: true }, null, 2));
