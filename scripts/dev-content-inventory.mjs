import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const cleanupTables = [
  "organizations",
  "publications",
  "publication_schedules",
  "menu_categories",
  "menu_items",
  "organization_members",
  "organization_member_invitations",
  "organization_applications",
  "media_assets",
  "important_announcements",
  "inaccuracy_reports",
  "analytics_events",
  "content_candidates",
  "content_ingestion_runs"
];

const preservedTables = [
  "profiles",
  "organization_types",
  "publication_categories",
  "content_sources"
];

const contentEntityTypes = [
  "organizations",
  "publications",
  "publication_schedules",
  "menu_categories",
  "menu_items",
  "organization_members",
  "organization_member_invitations",
  "organization_applications",
  "media_assets",
  "important_announcements",
  "inaccuracy_reports",
  "analytics_events",
  "content_candidates",
  "content_ingestion_runs"
];

const contentBuckets = [
  "organization-images",
  "publication-images",
  "menu-images",
  "application-confirmation-images"
];

function readLocalEnv() {
  try {
    return Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const separator = line.indexOf("=");
          const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
          return [line.slice(0, separator).trim(), value];
        })
    );
  } catch {
    return {};
  }
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = process.env.SUPABASE_PROJECT_REF ?? localEnv.SUPABASE_PROJECT_REF;

if (!serviceRoleKey?.startsWith("sb_secret_")) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a server sb_secret_ key.");
}
if (!supabaseUrl?.startsWith("https://")) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS URL.");
}
if (projectRef && new URL(supabaseUrl).hostname !== `${projectRef}.supabase.co`) {
  throw new Error("SUPABASE_PROJECT_REF does not match NEXT_PUBLIC_SUPABASE_URL.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

if (process.argv.includes("--candidate-summary")) {
  const { data, error } = await supabase
    .from("content_candidates")
    .select("id,action,status,decision,payload,evidence,warnings,source_url,source_excerpt,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Failed to load the candidate summary.");
  console.log(JSON.stringify({
    target: new URL(supabaseUrl).hostname,
    candidates: (data ?? []).map((candidate) => ({
      id: candidate.id,
      action: candidate.action,
      status: candidate.status,
      decision: candidate.decision,
      name: candidate.payload?.name ?? null,
      evidenceCount: Array.isArray(candidate.evidence) ? candidate.evidence.length : 0,
      nameInSourceExcerpt: typeof candidate.payload?.name === "string"
        && typeof candidate.source_excerpt === "string"
        && candidate.source_excerpt.toLocaleLowerCase("ru-RU").includes(
          candidate.payload.name.toLocaleLowerCase("ru-RU")
        ),
      warnings: candidate.warnings,
      sourceUrl: candidate.source_url,
      createdAt: candidate.created_at
    }))
  }, null, 2));
  process.exit(0);
}

if (process.argv.includes("--manifest-only")) {
  const [organizations, publications] = await Promise.all([
    supabase.from("organizations").select("id,name").order("id"),
    supabase.from("publications").select("id,title").order("id")
  ]);
  if (organizations.error || publications.error) {
    throw new Error("Failed to load the cleanup manifest.");
  }
  console.log(JSON.stringify({
    target: new URL(supabaseUrl).hostname,
    organizations: organizations.data ?? [],
    publications: publications.data ?? []
  }, null, 2));
  process.exit(0);
}

async function exactCount(table, configure = (query) => query) {
  const query = configure(supabase.from(table).select("id", { count: "exact", head: true }));
  const { count, error } = await query;
  if (error) {
    const detail = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" | ");
    throw new Error(`Failed to count ${table}: ${detail}`);
  }
  return count ?? 0;
}

async function listBucketFiles(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw new Error(`Failed to list ${bucket}: ${error.message}`);
    const items = data ?? [];
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id || item.metadata) files.push(path);
      else files.push(...await listBucketFiles(bucket, path));
    }
    if (items.length < 1000) break;
  }
  return files;
}

async function removeBucketFiles(bucket, paths) {
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await supabase.storage.from(bucket).remove(paths.slice(offset, offset + 100));
    if (error) throw new Error(`Failed to remove files from ${bucket}: ${error.message}`);
  }
}

const deleting = {};
for (const table of cleanupTables) deleting[table] = await exactCount(table);
deleting.audit_events = await exactCount("audit_events", (query) => query.or(
  `organization_id.not.is.null,entity_type.in.(${contentEntityTypes.join(",")})`
));

const preserving = {};
for (const table of preservedTables) preserving[table] = await exactCount(table);
preserving.admin_profiles = await exactCount("profiles", (query) => query.eq("role", "admin"));
const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000
});
if (authUsersError) throw new Error(`Failed to count auth users: ${authUsersError.message}`);
preserving.auth_users = authUsers.users.length;

const { error: mediaHashError } = await supabase
  .from("media_assets")
  .select("content_hash", { head: true })
  .limit(1);
if (mediaHashError) throw new Error("media_assets.content_hash is not available.");

const storagePaths = Object.fromEntries(
  await Promise.all(contentBuckets.map(async (bucket) => [bucket, await listBucketFiles(bucket)]))
);

const applyStorage = process.argv.includes("--remove-storage");
const includeManifest = process.argv.includes("--manifest");
if (applyStorage) {
  await Promise.all(contentBuckets.map((bucket) => removeBucketFiles(bucket, storagePaths[bucket])));
}

let manifest;
if (includeManifest) {
  const [organizations, publications] = await Promise.all([
    supabase.from("organizations").select("id,name").order("id"),
    supabase.from("publications").select("id,title").order("id")
  ]);
  if (organizations.error || publications.error) {
    throw new Error("Failed to load the cleanup manifest.");
  }
  manifest = {
    organizations: organizations.data ?? [],
    publications: publications.data ?? []
  };
}

console.log(JSON.stringify({
  target: new URL(supabaseUrl).hostname,
  serviceKeyType: "sb_secret_",
  deleting,
  preserving,
  schemaChecks: { mediaAssetContentHash: true },
  storageFiles: Object.fromEntries(contentBuckets.map((bucket) => [bucket, storagePaths[bucket].length])),
  storageRemoved: applyStorage,
  ...(manifest ? { manifest } : {})
}, null, 2));
