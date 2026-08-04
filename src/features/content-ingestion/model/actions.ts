"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  contentCandidateActions,
  contentCandidateDecisions,
  contentCandidatePayloadSchema,
  contentSourceKinds,
  contentSourceTrustLevels,
  publicationCandidatePayloadSchema,
  organizationCandidatePayloadSchema,
  type ContentCandidatePayload
} from "@/features/content-ingestion/model/contracts";
import {
  type AdminContentCandidateFilter,
  type ContentCandidateDetail,
  type ContentCandidateListItem,
  type ContentIngestionActionState,
  type PagedContentCandidates
} from "@/features/content-ingestion/model/types";
import { toMoscowIsoOrOriginal } from "@/features/content-ingestion/model/moscow-date";
import { normalizeSourceUrl } from "@/features/content-ingestion/server/secure-fetch";
import {
  processContentIngestionRequest,
  runScheduledContentIngestion
} from "@/features/content-ingestion/server/worker";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

const pageSize = 12;
const optionalUuidSchema = postgresUuidSchema.or(z.literal(""));
const actionFilterSchema = z.enum(contentCandidateActions).or(z.literal("all"));
const sourceSchema = z.object({
  name: z.string().trim().min(2).max(180),
  url: z.string().trim().url().max(1000),
  kind: z.enum(contentSourceKinds),
  trustLevel: z.enum(contentSourceTrustLevels)
});

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function actionError(message: string): ContentIngestionActionState {
  return { status: "error", message };
}

function actionSuccess(message: string): ContentIngestionActionState {
  return { status: "success", message };
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

async function getAdminContext() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Authentication required");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") throw new Error("Administrator access required");
  return { supabase, user: userData.user };
}

function parseStoredPayload(value: unknown) {
  const parsed = contentCandidatePayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseStoredEvidence(value: unknown) {
  const parsed = z.array(z.object({
    field: z.string(),
    excerpt: z.string(),
    sourceUrl: z.string()
  })).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export async function getPendingContentCandidateCount() {
  const { supabase } = await getAdminContext();
  const { count, error } = await supabase
    .from("content_candidates")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error("Failed to count import candidates");
  return count ?? 0;
}

export async function getAdminContentCandidates({
  status,
  action,
  sourceId,
  hasWarnings,
  page
}: {
  status: AdminContentCandidateFilter;
  action: string;
  sourceId: string;
  hasWarnings: boolean;
  page: number;
}): Promise<PagedContentCandidates> {
  const { supabase } = await getAdminContext();
  const safePage = Math.max(1, Math.trunc(page));
  const safeAction = actionFilterSchema.safeParse(action);
  const safeSourceId = optionalUuidSchema.safeParse(sourceId);
  const from = (safePage - 1) * pageSize;

  let query = supabase
    .from("content_candidates")
    .select("*, content_sources(id, name, url, trust_level)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (status !== "all") query = query.eq("status", status);
  if (safeAction.success && safeAction.data !== "all") query = query.eq("action", safeAction.data);
  if (safeSourceId.success && safeSourceId.data) query = query.eq("source_id", safeSourceId.data);
  if (hasWarnings) query = query.not("warnings", "eq", "[]");

  const { data, count, error } = await query;
  if (error) throw new Error("Failed to load import candidates");

  return {
    items: (data ?? []) as ContentCandidateListItem[],
    page: safePage,
    pageSize,
    total: count ?? 0,
    filters: {
      status,
      action: safeAction.success ? safeAction.data : "all",
      sourceId: safeSourceId.success ? safeSourceId.data : "",
      hasWarnings
    }
  };
}

export async function getAdminContentCandidate(id: string): Promise<ContentCandidateDetail | null> {
  const parsedId = postgresUuidSchema.safeParse(id);
  if (!parsedId.success) return null;
  const { supabase } = await getAdminContext();
  const { data, error } = await supabase
    .from("content_candidates")
    .select("*")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error || !data) return null;

  const parsedPayload = parseStoredPayload(data.payload);
  if (!parsedPayload) return null;
  const [source, run, duplicateCandidate, duplicatePublication, duplicateOrganization, dependencyCandidate] = await Promise.all([
    data.source_id
      ? supabase.from("content_sources").select("id, name, url, trust_level").eq("id", data.source_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    data.run_id
      ? supabase.from("content_ingestion_runs").select("id, status, trigger, started_at, finished_at").eq("id", data.run_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    data.duplicate_of_id
      ? supabase.from("content_candidates").select("id, action, payload, status").eq("id", data.duplicate_of_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    data.duplicate_publication_id
      ? supabase.from("publications").select("id, slug, title, status").eq("id", data.duplicate_publication_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    data.duplicate_organization_id
      ? supabase.from("organizations").select("id, slug, name, status").eq("id", data.duplicate_organization_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    data.depends_on_candidate_id
      ? supabase.from("content_candidates").select("id, action, payload, status, result_organization_id").eq("id", data.depends_on_candidate_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if ([source, run, duplicateCandidate, duplicatePublication, duplicateOrganization, dependencyCandidate].some((result) => result.error)) {
    return null;
  }
  return {
    ...data,
    content_sources: source.data,
    content_ingestion_runs: run.data,
    duplicate_candidate: duplicateCandidate.data,
    duplicate_publication: duplicatePublication.data,
    duplicate_organization: duplicateOrganization.data,
    dependency_candidate: dependencyCandidate.data,
    parsedPayload,
    parsedEvidence: parseStoredEvidence(data.evidence)
  } as unknown as ContentCandidateDetail;
}

export async function getContentIngestionAdminOptions() {
  const { supabase } = await getAdminContext();
  const [sources, organizations, organizationTypes, publicationCategories, publications] = await Promise.all([
    supabase.from("content_sources").select("id, name, url, trust_level, is_active").order("name"),
    supabase.from("organizations").select("id, name, slug").eq("status", "active").order("name"),
    supabase.from("organization_types").select("id, name, slug").eq("is_active", true).order("sort_order"),
    supabase.from("publication_categories").select("id, name, slug").eq("is_active", true).order("sort_order"),
    supabase.from("publications")
      .select("id, organization_id, title, starts_at, valid_until")
      .in("status", ["draft", "scheduled", "published"])
      .order("created_at", { ascending: false })
      .limit(500)
  ]);
  if (sources.error || organizations.error || organizationTypes.error || publicationCategories.error || publications.error) {
    throw new Error("Failed to load import options");
  }
  return {
    sources: sources.data ?? [],
    organizations: organizations.data ?? [],
    organizationTypes: organizationTypes.data ?? [],
    publicationCategories: publicationCategories.data ?? [],
    publications: publications.data ?? []
  };
}

export async function getContentSources() {
  const { supabase } = await getAdminContext();
  const { data, error } = await supabase
    .from("content_sources")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");
  if (error) throw new Error("Failed to load content sources");
  return data ?? [];
}

export async function getRecentContentIngestionRuns(limit = 10) {
  const { supabase } = await getAdminContext();
  const { data, error } = await supabase
    .from("content_ingestion_runs")
    .select("*, content_sources(id, name, url)")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(30, Math.trunc(limit))));
  if (error) throw new Error("Failed to load ingestion runs");
  return data ?? [];
}

function parseCandidateForm(formData: FormData): ContentCandidatePayload | null {
  const payloadKind = getString(formData, "payloadKind");
  if (payloadKind === "organization") {
    let contactLinks: unknown = [];
    try {
      contactLinks = JSON.parse(getString(formData, "contactLinks") || "[]");
    } catch {
      return null;
    }
    const parsed = organizationCandidatePayloadSchema.safeParse({
      kind: "organization",
      name: getString(formData, "name"),
      typeSlug: getString(formData, "typeSlug"),
      description: optionalText(getString(formData, "description")),
      address: optionalText(getString(formData, "address")),
      phone: optionalText(getString(formData, "phone")),
      workingHours: optionalText(getString(formData, "workingHours")),
      contactLinks
    });
    return parsed.success ? parsed.data : null;
  }

  let scheduleEntries: unknown = [];
  try {
    scheduleEntries = JSON.parse(getString(formData, "scheduleEntries") || "[]");
  } catch {
    return null;
  }
  const parsed = publicationCandidatePayloadSchema.safeParse({
    kind: "publication",
    organizationId: optionalText(getString(formData, "organizationId")),
    organizationName: getString(formData, "organizationName"),
    targetPublicationId: optionalText(getString(formData, "targetPublicationId")),
    type: getString(formData, "publicationType"),
    title: getString(formData, "title"),
    description: optionalText(getString(formData, "description")),
    categorySlug: getString(formData, "categorySlug"),
    startsAt: toMoscowIsoOrOriginal(getString(formData, "startsAt")),
    endsAt: toMoscowIsoOrOriginal(getString(formData, "endsAt")),
    validUntil: toMoscowIsoOrOriginal(getString(formData, "validUntil")),
    place: optionalText(getString(formData, "place")),
    priceText: optionalText(getString(formData, "priceText")),
    isFree: formData.get("isFree") === "on",
    ageLimit: optionalText(getString(formData, "ageLimit")),
    contactPhone: optionalText(getString(formData, "contactPhone")),
    scheduleEntries,
    imageSourceUrl: optionalText(getString(formData, "imageSourceUrl"))
  });
  return parsed.success ? parsed.data : null;
}

export async function reviewContentCandidateAction(
  _state: ContentIngestionActionState,
  formData: FormData
): Promise<ContentIngestionActionState> {
  const candidateId = postgresUuidSchema.safeParse(getString(formData, "candidateId"));
  const decision = z.enum(contentCandidateDecisions).safeParse(getString(formData, "decision"));
  if (!candidateId.success || !decision.success) return actionError("Кандидат или действие не найдены.");
  const reviewComment = optionalText(getString(formData, "reviewComment"));
  if (decision.data === "reject" && (!reviewComment || reviewComment.length < 3)) {
    return actionError("Укажите причину отклонения.");
  }

  const { supabase } = await getAdminContext();
  let payload: ContentCandidatePayload | null = null;
  if (decision.data !== "mark_not_duplicate" && decision.data !== "reject") {
    payload = parseCandidateForm(formData);
    if (!payload) return actionError("Проверьте заполненные поля и расписание.");
  }

  const { error } = await supabase.rpc("review_content_candidate", {
    p_candidate_id: candidateId.data,
    p_decision: decision.data,
    p_payload: payload,
    p_review_comment: reviewComment
  });
  if (error) return actionError(error.message || "Не получилось сохранить решение.");

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/imports");
  revalidatePath(`/admin/imports/${candidateId.data}`);
  revalidatePath("/organizations");
  return actionSuccess(decision.data === "mark_not_duplicate"
    ? "Отметка о дубле снята."
    : decision.data === "reject"
      ? "Кандидат отклонён."
      : decision.data === "approve_draft"
        ? "Кандидат сохранён как черновик."
        : "Кандидат одобрен.");
}

export async function createContentSourceAction(
  _state: ContentIngestionActionState,
  formData: FormData
): Promise<ContentIngestionActionState> {
  const parsed = sourceSchema.safeParse({
    name: getString(formData, "name"),
    url: getString(formData, "url"),
    kind: getString(formData, "kind"),
    trustLevel: getString(formData, "trustLevel")
  });
  if (!parsed.success) return actionError("Проверьте название, URL и параметры источника.");

  let canonicalUrl: string;
  try {
    canonicalUrl = normalizeSourceUrl(parsed.data.url);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "URL источника запрещён.");
  }
  const { supabase, user } = await getAdminContext();
  const { error } = await supabase.from("content_sources").insert({
    name: parsed.data.name,
    kind: parsed.data.kind,
    url: parsed.data.url,
    canonical_url: canonicalUrl,
    trust_level: parsed.data.trustLevel,
    created_by: user.id
  });
  if (error) return actionError(error.code === "23505" ? "Такой источник уже добавлен." : "Не получилось добавить источник.");
  revalidatePath("/admin/imports");
  return actionSuccess("Источник добавлен.");
}

export async function updateContentSourceAction(formData: FormData) {
  const parsed = z.object({
    sourceId: postgresUuidSchema,
    isActive: z.enum(["true", "false"]),
    fetchIntervalMinutes: z.coerce.number().int().min(60).max(43_200)
  }).safeParse({
    sourceId: getString(formData, "sourceId"),
    isActive: getString(formData, "isActive"),
    fetchIntervalMinutes: getString(formData, "fetchIntervalMinutes")
  });
  if (!parsed.success) return;
  const { supabase } = await getAdminContext();
  await supabase.from("content_sources").update({
    is_active: parsed.data.isActive === "true",
    fetch_interval_minutes: parsed.data.fetchIntervalMinutes,
    next_check_at: new Date().toISOString()
  }).eq("id", parsed.data.sourceId);
  revalidatePath("/admin/imports");
}

export async function enqueueManualUrlAction(
  _state: ContentIngestionActionState,
  formData: FormData
): Promise<ContentIngestionActionState> {
  const url = getString(formData, "url");
  const { user } = await getAdminContext();
  try {
    const result = await processContentIngestionRequest({ url, trigger: "admin", actorId: user.id });
    revalidatePath("/admin/imports");
    return actionSuccess(`Обработка завершена: новых кандидатов — ${result.createdCount}.`);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "Не получилось обработать URL.");
  }
}

export async function runContentIngestionNowAction(
  _state: ContentIngestionActionState,
  _formData: FormData
): Promise<ContentIngestionActionState> {
  void _state;
  void _formData;
  const { user } = await getAdminContext();
  try {
    const result = await runScheduledContentIngestion({ trigger: "admin", actorId: user.id, force: true });
    revalidatePath("/admin/imports");
    return actionSuccess(`Проверено источников: ${result.processed}; новых кандидатов: ${result.created}.`);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "Не получилось запустить сбор.");
  }
}
