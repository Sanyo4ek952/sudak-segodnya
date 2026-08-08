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
  type ContentCandidateAction,
  type ContentCandidatePayload
} from "@/features/content-ingestion/model/contracts";
import {
  contentCandidateFormIntents,
  normalizePublicationCandidateForType,
  validateCandidateForIntent,
  type ContentCandidateFieldErrors
} from "@/features/content-ingestion/model/candidate-form";
import {
  applyOrganizationDefaults,
  type ImportOrganization
} from "@/features/content-ingestion/model/organization-resolution";
import {
  type AdminContentCandidateFilter,
  type ContentCandidateDetail,
  type ContentCandidateListItem,
  type ContentIngestionActionState,
  type PagedContentCandidates
} from "@/features/content-ingestion/model/types";
import { toMoscowIsoOrOriginal } from "@/features/content-ingestion/model/moscow-date";
import {
  isUrlExcludedByDomain,
  normalizeExcludedDomain
} from "@/features/content-ingestion/model/domain-exclusion";
import { normalizeSourceUrl } from "@/features/content-ingestion/server/secure-fetch";
import {
  IMAGE_IMPORT_WARNING_PREFIX,
  importCandidateImage
} from "@/features/content-ingestion/server/imported-image";
import {
  processContentIngestionRequest,
  runScheduledContentIngestion
} from "@/features/content-ingestion/server/worker";
import { hasExplicitCancellationEvidence } from "@/features/content-ingestion/model/candidate-rules";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import { createSupabaseAdminClient } from "@/shared/api/supabase/admin";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

const pageSize = 12;
const optionalUuidSchema = postgresUuidSchema.or(z.literal(""));
const actionFilterSchema = z.enum(contentCandidateActions).or(z.literal("all"));
const sourceSchema = z.object({
  name: z.string().trim().min(2, "Укажите название источника.").max(180),
  url: z.string().trim().url("Укажите корректный URL.").max(1000),
  kind: z.enum(contentSourceKinds),
  trustLevel: z.enum(contentSourceTrustLevels),
  organizationId: optionalUuidSchema,
  fetchIntervalMinutes: z.coerce.number().int().min(60).max(43_200),
  notes: z.string().trim().max(2000),
  activateAfterTest: z.boolean()
});
const sourceSettingsSchema = z.object({
  sourceId: postgresUuidSchema,
  organizationId: optionalUuidSchema,
  fetchIntervalMinutes: z.coerce.number().int().min(60).max(43_200),
  notes: z.string().trim().max(2000),
  intent: z.enum(["save", "test", "enable", "disable"])
});
const reviewResultSchema = z.object({
  organization_candidate_id: postgresUuidSchema.nullable().optional(),
  organization_id: postgresUuidSchema.nullable().optional(),
  publication_id: postgresUuidSchema.nullable().optional()
}).passthrough();
const draftResultSchema = z.object({
  updated_at: z.string(),
  dependency_updated_at: z.string().nullable().optional()
}).passthrough();

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function actionError(
  message: string,
  fieldErrors?: ContentCandidateFieldErrors,
  intent?: ContentIngestionActionState["intent"]
): ContentIngestionActionState {
  return { status: "error", message, fieldErrors, intent };
}

function actionSuccess(
  message: string,
  extra: Partial<ContentIngestionActionState> = {}
): ContentIngestionActionState {
  return { status: "success", message, ...extra };
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function firstZodFieldErrors(error: z.ZodError, prefix = "") {
  const fieldErrors: ContentCandidateFieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".");
    const field = prefix && path
      ? `${prefix}${path.charAt(0).toUpperCase()}${path.slice(1)}`
      : prefix || path || "form";
    if (!fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

function translatedIngestionError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  const translations: Array<[RegExp, string]> = [
    [/changed by another administrator/i, "Материал уже изменил другой администратор. Обновите страницу и проверьте новые данные."],
    [/no longer editable|cannot be reviewed from its current status/i, "Материал уже обработан и больше не доступен для редактирования."],
    [/active organization not found/i, "Выбранная организация не найдена или больше не активна."],
    [/target publication not found/i, "Выбранная публикация не найдена."],
    [/does not belong to the target organization/i, "Выбранная публикация принадлежит другой организации."],
    [/required organization fields are incomplete/i, "Заполните название, описание и телефон организации."],
    [/description must contain at least 10 characters/i, "Добавьте описание минимум на 10 символов."],
    [/event start and valid end are required/i, "Проверьте начало и окончание мероприятия."],
    [/imported event has already ended/i, "Нельзя опубликовать уже завершившееся мероприятие."],
    [/imported news source publication date is required/i, "Укажите дату публикации новости в первичном источнике."],
    [/imported news validity must equal seven days/i, "Срок импортированной новости должен составлять 7 дней от даты в источнике."],
    [/active organization with this normalized name already exists/i, "Организация с таким названием уже создана. Обновите страницу и выберите её из списка."],
    [/event place is required/i, "Укажите место проведения мероприятия."],
    [/validity date must be in the future/i, "Срок актуальности должен быть в будущем."],
    [/regular activity schedule is required/i, "Добавьте расписание регулярного занятия."],
    [/every regular schedule entry requires a start time/i, "Укажите время начала для каждого интервала расписания."],
    [/price or free marker is required/i, "Укажите цену или отметьте бесплатное участие."],
    [/published publication cannot become a draft/i, "Опубликованную публикацию нельзя вернуть в черновик. Примените обновление сразу."],
    [/publication cannot be edited in its current status/i, "Публикацию в текущем статусе нельзя обновить через импорт."],
    [/only a published publication can be cancelled/i, "Отменить можно только опубликованную публикацию."],
    [/explicit primary cancellation source is required/i, "Источник не содержит явного подтверждения отмены."],
    [/administrator access required/i, "Для этого действия нужны права администратора."],
    [/source domain is excluded/i, "Этот домен исключён из импорта."],
    [/candidate payload does not match/i, "Данные кандидата не соответствуют типу операции."]
  ];
  return translations.find(([pattern]) => pattern.test(message))?.[1]
    ?? (message && !/^[A-Za-z0-9 _.,'():-]+$/.test(message)
      ? message
      : "Не удалось сохранить изменения. Обновите страницу и попробуйте снова.");
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
    .select("*, content_sources(id, name, url, trust_level, adapter_id, organization_id)", { count: "exact" })
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
      ? supabase.from("content_sources").select("id, name, url, trust_level, adapter_id, organization_id").eq("id", data.source_id).maybeSingle()
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
      ? supabase.from("content_candidates").select("id, action, payload, status, result_organization_id, updated_at").eq("id", data.depends_on_candidate_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if ([source, run, duplicateCandidate, duplicatePublication, duplicateOrganization, dependencyCandidate].some((result) => result.error)) {
    return null;
  }
  const dependencyPayload = dependencyCandidate.data?.action === "create_organization"
    ? organizationCandidatePayloadSchema.safeParse(dependencyCandidate.data.payload)
    : null;
  return {
    ...data,
    content_sources: source.data,
    content_ingestion_runs: run.data,
    duplicate_candidate: duplicateCandidate.data,
    duplicate_publication: duplicatePublication.data,
    duplicate_organization: duplicateOrganization.data,
    dependency_candidate: dependencyCandidate.data,
    parsedPayload,
    parsedDependencyOrganization: dependencyPayload?.success ? dependencyPayload.data : null,
    parsedEvidence: parseStoredEvidence(data.evidence)
  } as unknown as ContentCandidateDetail;
}

export async function getContentIngestionAdminOptions() {
  const { supabase } = await getAdminContext();
  const [sources, organizations, organizationTypes, publicationCategories, publications] = await Promise.all([
    supabase.from("content_sources").select("id, name, url, trust_level, is_active").order("name"),
    supabase.from("organizations").select("id, name, slug, address, phone").eq("status", "active").order("name"),
    supabase.from("organization_types").select("id, name, slug").eq("is_active", true).order("sort_order"),
    supabase.from("publication_categories").select("id, name, slug").eq("is_active", true).order("sort_order"),
    supabase.from("publications")
      .select("id, organization_id, title, starts_at, valid_until, status")
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

export async function getContentIngestionDomainExclusions() {
  const { supabase } = await getAdminContext();
  const { data, error } = await supabase
    .from("content_ingestion_domain_exclusions")
    .select("*")
    .order("domain");
  if (error) throw new Error("Failed to load excluded import domains");
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

function formFieldName(prefix: string, name: string) {
  return prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;
}

const candidateFieldMessages: Record<string, string> = {
  name: "Укажите название организации: от 2 до 160 символов.",
  typeSlug: "Выберите тип организации.",
  description: "Описание слишком длинное.",
  address: "Адрес слишком длинный.",
  phone: "Телефон слишком длинный.",
  workingHours: "График работы слишком длинный.",
  contactLinks: "Проверьте подпись и публичный HTTPS-адрес ссылки.",
  imageSourceUrl: "Укажите публичный HTTPS-адрес изображения.",
  organizationName: "Не удалось определить название организации.",
  targetPublicationId: "Выберите существующую публикацию.",
  publicationType: "Выберите тип публикации.",
  type: "Выберите тип публикации.",
  title: "Укажите название публикации: от 3 до 180 символов.",
  categorySlug: "Выберите категорию ленты.",
  startsAt: "Укажите корректные дату и время начала.",
  endsAt: "Укажите корректные дату и время окончания.",
  validUntil: "Укажите корректный срок актуальности.",
  sourcePublishedAt: "Укажите корректную дату публикации в первичном источнике.",
  place: "Место слишком длинное.",
  priceText: "Цена или условия слишком длинные.",
  ageLimit: "Возрастное ограничение слишком длинное.",
  contactPhone: "Контактный телефон слишком длинный.",
  scheduleEntries: "Проверьте заполненные интервалы расписания."
};

const sourceFieldMessages: Record<string, string> = {
  name: "Укажите название источника: от 2 до 180 символов.",
  url: "Укажите публичный HTTPS-адрес источника.",
  kind: "Выберите формат источника.",
  trustLevel: "Выберите уровень доверия к источнику.",
  organizationId: "Выберите организацию из списка.",
  fetchIntervalMinutes: "Интервал должен быть от 60 до 43 200 минут.",
  notes: "Заметки не должны превышать 2 000 символов."
};

function mappedSourceErrors(error: z.ZodError) {
  const errors = firstZodFieldErrors(error);
  return Object.fromEntries(
    Object.keys(errors).map((field) => [field, sourceFieldMessages[field] ?? "Проверьте значение поля."])
  );
}

function mappedCandidateErrors(error: z.ZodError, prefix = "") {
  const errors = firstZodFieldErrors(error, prefix);
  const mapped: ContentCandidateFieldErrors = {};
  for (const [field, message] of Object.entries(errors)) {
    const unprefixed = prefix && field.startsWith(prefix)
      ? `${field.charAt(prefix.length).toLocaleLowerCase("ru-RU")}${field.slice(prefix.length + 1)}`
      : field;
    const baseField = unprefixed.split(".")[0];
    const outputField = !prefix && field === "type" ? "publicationType" : field;
    mapped[outputField] = candidateFieldMessages[baseField] ?? message;
  }
  return mapped;
}

function parseOrganizationCandidateForm(formData: FormData, prefix = "") {
  let contactLinks: unknown = [];
  try {
    contactLinks = JSON.parse(getString(formData, formFieldName(prefix, "contactLinks")) || "[]");
  } catch {
    return {
      payload: null,
      fieldErrors: {
        [formFieldName(prefix, "contactLinks")]: "Проверьте ссылки организации."
      }
    };
  }
  const parsed = organizationCandidatePayloadSchema.safeParse({
    kind: "organization",
    name: getString(formData, formFieldName(prefix, "name")),
    typeSlug: getString(formData, formFieldName(prefix, "typeSlug")),
    description: optionalText(getString(formData, formFieldName(prefix, "description"))),
    address: optionalText(getString(formData, formFieldName(prefix, "address"))),
    phone: optionalText(getString(formData, formFieldName(prefix, "phone"))),
    workingHours: optionalText(getString(formData, formFieldName(prefix, "workingHours"))),
    contactLinks,
    imageSourceUrl: optionalText(getString(formData, formFieldName(prefix, "imageSourceUrl")))
  });
  return parsed.success
    ? { payload: parsed.data, fieldErrors: {} }
    : { payload: null, fieldErrors: mappedCandidateErrors(parsed.error, prefix) };
}

function parseCandidateForm(formData: FormData): {
  payload: ContentCandidatePayload | null;
  fieldErrors: ContentCandidateFieldErrors;
} {
  const payloadKind = getString(formData, "payloadKind");
  if (payloadKind === "organization") {
    return parseOrganizationCandidateForm(formData);
  }

  let scheduleEntries: unknown = [];
  try {
    scheduleEntries = JSON.parse(getString(formData, "scheduleEntries") || "[]");
  } catch {
    return {
      payload: null,
      fieldErrors: { scheduleEntries: "Не удалось прочитать расписание. Проверьте интервалы." }
    };
  }
  const organizationId = postgresUuidSchema.safeParse(getString(formData, "organizationId"));
  const parsed = publicationCandidatePayloadSchema.safeParse({
    kind: "publication",
    organizationId: organizationId.success ? organizationId.data : null,
    organizationName: getString(formData, "organizationName"),
    targetPublicationId: optionalText(getString(formData, "targetPublicationId")),
    type: getString(formData, "publicationType"),
    title: getString(formData, "title"),
    description: optionalText(getString(formData, "description")),
    categorySlug: getString(formData, "categorySlug"),
    startsAt: toMoscowIsoOrOriginal(getString(formData, "startsAt")),
    endsAt: toMoscowIsoOrOriginal(getString(formData, "endsAt")),
    validUntil: toMoscowIsoOrOriginal(getString(formData, "validUntil")),
    sourcePublishedAt: toMoscowIsoOrOriginal(getString(formData, "sourcePublishedAt")),
    place: optionalText(getString(formData, "place")),
    priceText: optionalText(getString(formData, "priceText")),
    isFree: formData.get("isFree") === "on",
    ageLimit: optionalText(getString(formData, "ageLimit")),
    contactPhone: optionalText(getString(formData, "contactPhone")),
    scheduleEntries,
    imageSourceUrl: optionalText(getString(formData, "imageSourceUrl"))
  });
  if (!parsed.success) {
    return { payload: null, fieldErrors: mappedCandidateErrors(parsed.error) };
  }
  return {
    payload: normalizePublicationCandidateForType(parsed.data),
    fieldErrors: {}
  };
}

async function setCandidateImageWarning(candidateId: string, message: string | null) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("content_candidates")
    .select("warnings")
    .eq("id", candidateId)
    .maybeSingle();
  if (error || !data) return;
  const existing = Array.isArray(data.warnings)
    ? data.warnings.filter((item): item is string => typeof item === "string")
    : [];
  const warnings = existing.filter((warning) => !warning.startsWith(IMAGE_IMPORT_WARNING_PREFIX));
  if (message) warnings.push(`${IMAGE_IMPORT_WARNING_PREFIX} ${message}`);
  await admin.from("content_candidates").update({ warnings }).eq("id", candidateId);
}

async function importReviewedCandidateImage({
  candidateId,
  candidateAction,
  payload,
  organizationId,
  publicationId,
  uploadedBy
}: {
  candidateId: string;
  candidateAction: ContentCandidateAction;
  payload: ContentCandidatePayload;
  organizationId?: string | null;
  publicationId?: string | null;
  uploadedBy: string;
}) {
  if (candidateAction === "cancel_publication") return { status: "skipped" as const };
  if (!payload.imageSourceUrl) {
    const message = "источник не предоставил URL; используется нейтральная заглушка.";
    await setCandidateImageWarning(candidateId, message);
    return { status: "warning" as const, message };
  }

  const owner = payload.kind === "organization"
    ? organizationId
      ? { kind: "organization" as const, id: organizationId, altText: `Фото организации «${payload.name}»` }
      : null
    : publicationId
      ? { kind: "publication" as const, id: publicationId, altText: `Изображение к публикации «${payload.title}»` }
      : null;
  if (!owner) {
    const message = "созданный материал не найден; повторите импорт изображения.";
    await setCandidateImageWarning(candidateId, message);
    return { status: "warning" as const, message };
  }

  try {
    const result = await importCandidateImage({
      sourceUrl: payload.imageSourceUrl,
      owner,
      uploadedBy
    });
    await setCandidateImageWarning(candidateId, null);
    return result;
  } catch (error) {
    const message = error instanceof Error
      ? error.message.slice(0, 500)
      : "не удалось импортировать изображение; повторите попытку.";
    await setCandidateImageWarning(candidateId, message);
    return { status: "warning" as const, message };
  }
}

export async function reviewContentCandidateAction(
  _state: ContentIngestionActionState,
  formData: FormData
): Promise<ContentIngestionActionState> {
  const candidateId = postgresUuidSchema.safeParse(getString(formData, "candidateId"));
  const intent = z.enum(contentCandidateFormIntents).safeParse(getString(formData, "intent"));
  const expectedUpdatedAt = z.string().min(1).safeParse(getString(formData, "expectedUpdatedAt"));
  if (!candidateId.success || !intent.success || !expectedUpdatedAt.success) {
    return actionError("Кандидат или действие не найдены.");
  }
  const reviewComment = optionalText(getString(formData, "reviewComment"));
  if (intent.data === "reject" && (!reviewComment || reviewComment.length < 3)) {
    return actionError(
      "Укажите причину отклонения.",
      { reviewComment: "Причина отклонения должна содержать минимум 3 символа." },
      intent.data
    );
  }

  const { supabase, user } = await getAdminContext();
  const { data: candidateRecord, error: candidateError } = await supabase
    .from("content_candidates")
    .select("action, status, depends_on_candidate_id, evidence, updated_at")
    .eq("id", candidateId.data)
    .maybeSingle();
  if (candidateError || !candidateRecord) return actionError("Кандидат не найден.", undefined, intent.data);

  let payload: ContentCandidatePayload | null = null;
  const editsAreSubmitted = intent.data !== "reject";
  if (editsAreSubmitted) {
    const parsedCandidate = parseCandidateForm(formData);
    if (!parsedCandidate.payload) {
      return actionError(
        "Проверьте отмеченные поля. Введённые данные сохранены в форме.",
        parsedCandidate.fieldErrors,
        intent.data
      );
    }
    payload = parsedCandidate.payload;
  }

  const createDependencyOrganization = editsAreSubmitted
    && getString(formData, "organizationId") === "create_dependency";
  const parsedDependency = createDependencyOrganization
    ? parseOrganizationCandidateForm(formData, "dependency")
    : null;
  const dependencyPayload = parsedDependency?.payload ?? null;
  const submittedDependencyId = postgresUuidSchema.safeParse(
    getString(formData, "dependencyCandidateId")
  );
  const editableDependencyCandidateId = submittedDependencyId.success
    && submittedDependencyId.data === candidateRecord.depends_on_candidate_id
    ? submittedDependencyId.data
    : null;
  if (createDependencyOrganization && (!payload || !editableDependencyCandidateId || !dependencyPayload)) {
    return actionError(
      "Проверьте данные новой организации.",
      parsedDependency?.fieldErrors ?? {
        organizationId: "Связанный кандидат организации больше не доступен."
      },
      intent.data
    );
  }

  if (payload?.kind === "publication" && payload.organizationId) {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id, name, address, phone")
      .eq("id", payload.organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (organizationError || !organization) {
      return actionError(
        "Выбранная организация больше не доступна.",
        { organizationId: "Выберите действующую организацию." },
        intent.data
      );
    }
    payload = normalizePublicationCandidateForType(
      applyOrganizationDefaults(payload, organization as ImportOrganization)
    );
  }

  const fieldErrors = payload
    ? validateCandidateForIntent({
        payload,
        action: candidateRecord.action,
        intent: intent.data
      })
    : {};
  if (createDependencyOrganization) delete fieldErrors.organizationId;

  if (dependencyPayload && intent.data !== "save_changes" && intent.data !== "mark_not_duplicate") {
    const dependencyErrors = validateCandidateForIntent({
      payload: dependencyPayload,
      action: "create_organization",
      intent: intent.data === "approve_draft" ? "approve_publish" : intent.data
    });
    for (const [field, message] of Object.entries(dependencyErrors)) {
      const prefixed = `dependency${field.charAt(0).toUpperCase()}${field.slice(1)}`;
      fieldErrors[prefixed] = message;
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return actionError(
      "Исправьте отмеченные поля. Остальные данные останутся в форме.",
      fieldErrors,
      intent.data
    );
  }

  if (
    intent.data === "approve_publish"
    && candidateRecord.action === "cancel_publication"
    && !hasExplicitCancellationEvidence(parseStoredEvidence(candidateRecord.evidence))
  ) {
    return actionError(
      "Отмена не подтверждена первичным источником.",
      { targetPublicationId: "Публикацию нельзя отменить без явного подтверждения в источнике." },
      intent.data
    );
  }

  const dependencyCandidateId = editableDependencyCandidateId;
  const dependencyExpectedUpdatedAt = optionalText(getString(formData, "dependencyExpectedUpdatedAt"));
  let currentExpectedUpdatedAt = expectedUpdatedAt.data;
  let currentDependencyUpdatedAt = dependencyExpectedUpdatedAt;

  if (payload) {
    const { data: draftResult, error: draftError } = await supabase.rpc(
      "save_content_candidate_draft",
      {
        p_candidate_id: candidateId.data,
        p_payload: payload,
        p_expected_updated_at: currentExpectedUpdatedAt,
        p_target_organization_id: payload.kind === "publication" ? payload.organizationId : null,
        p_target_publication_id: payload.kind === "publication" ? payload.targetPublicationId : null,
        p_dependency_candidate_id: dependencyCandidateId,
        p_dependency_payload: createDependencyOrganization ? dependencyPayload : null,
        p_dependency_expected_updated_at: dependencyCandidateId ? currentDependencyUpdatedAt : null
      }
    );
    if (draftError) {
      return actionError(translatedIngestionError(draftError), undefined, intent.data);
    }
    const parsedDraft = draftResultSchema.safeParse(draftResult);
    if (!parsedDraft.success) {
      return actionError("Правки сохранены, но сервер не вернул новую версию материала. Обновите страницу.", undefined, intent.data);
    }
    currentExpectedUpdatedAt = parsedDraft.data.updated_at;
    currentDependencyUpdatedAt = parsedDraft.data.dependency_updated_at ?? currentDependencyUpdatedAt;
    if (intent.data === "save_changes") {
      revalidatePath("/admin/imports");
      revalidatePath(`/admin/imports/${candidateId.data}`);
      return actionSuccess("Правки кандидата сохранены. Публичные данные не изменены.", {
        intent: intent.data,
        updatedAt: currentExpectedUpdatedAt,
        dependencyUpdatedAt: currentDependencyUpdatedAt ?? undefined
      });
    }
  }

  const decision = z.enum(contentCandidateDecisions).safeParse(intent.data);
  if (!decision.success) return actionError("Неизвестное решение по кандидату.", undefined, intent.data);

  const { data: reviewResult, error } = createDependencyOrganization && dependencyPayload
    ? await supabase.rpc("review_content_candidate_with_organization_guarded", {
        p_candidate_id: candidateId.data,
        p_decision: decision.data,
        p_payload: payload,
        p_review_comment: reviewComment,
        p_expected_updated_at: currentExpectedUpdatedAt,
        p_organization_candidate_id: dependencyCandidateId!,
        p_organization_payload: dependencyPayload,
        p_organization_expected_updated_at: currentDependencyUpdatedAt!
      })
    : await supabase.rpc("review_content_candidate_guarded", {
        p_candidate_id: candidateId.data,
        p_decision: decision.data,
        p_payload: payload,
        p_review_comment: reviewComment,
        p_expected_updated_at: currentExpectedUpdatedAt
      });
  if (error) {
    return {
      ...actionError(translatedIngestionError(error), undefined, intent.data),
      updatedAt: currentExpectedUpdatedAt,
      dependencyUpdatedAt: currentDependencyUpdatedAt ?? undefined
    };
  }

  const imageWarnings: string[] = [];
  const parsedResult = reviewResultSchema.safeParse(reviewResult);
  if (dependencyPayload && parsedResult.success) {
    const dependencyImageResult = await importReviewedCandidateImage({
      candidateId: dependencyCandidateId!,
      candidateAction: "create_organization",
      payload: dependencyPayload,
      organizationId: parsedResult.data.organization_id,
      uploadedBy: user.id
    });
    if (dependencyImageResult.status === "warning") imageWarnings.push(dependencyImageResult.message);
  }
  if (payload && decision.data !== "reject" && decision.data !== "mark_not_duplicate") {
    const imageResult = await importReviewedCandidateImage({
      candidateId: candidateId.data,
      candidateAction: candidateRecord.action,
      payload,
      organizationId: parsedResult.success ? parsedResult.data.organization_id : null,
      publicationId: parsedResult.success ? parsedResult.data.publication_id : null,
      uploadedBy: user.id
    });
    if (imageResult.status === "warning") imageWarnings.push(imageResult.message);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/imports");
  revalidatePath(`/admin/imports/${candidateId.data}`);
  revalidatePath("/organizations");
  const message = decision.data === "mark_not_duplicate"
    ? "Отметка о дубле снята."
    : decision.data === "reject"
      ? "Кандидат отклонён."
      : decision.data === "approve_draft"
        ? "Кандидат сохранён как черновик."
        : "Кандидат одобрен.";
  return actionSuccess(imageWarnings.length > 0
    ? `${message} Изображение не импортировано: ${imageWarnings.join(" ")}`
    : message, { intent: intent.data });
}

export async function retryCandidateImageAction(
  _state: ContentIngestionActionState,
  formData: FormData
): Promise<ContentIngestionActionState> {
  const candidateId = postgresUuidSchema.safeParse(getString(formData, "candidateId"));
  if (!candidateId.success) return actionError("Кандидат не найден.");
  const { user } = await getAdminContext();
  const admin = createSupabaseAdminClient();
  const { data: candidate, error } = await admin
    .from("content_candidates")
    .select("action, status, payload, result_organization_id, result_publication_id")
    .eq("id", candidateId.data)
    .maybeSingle();
  if (error || !candidate || candidate.status !== "approved") {
    return actionError("Повторный импорт доступен только для одобренного кандидата.");
  }
  if (candidate.action === "cancel_publication") {
    return actionError("Для отмены публикации изображение не импортируется.");
  }
  const payload = parseStoredPayload(candidate.payload);
  if (!payload) return actionError("Данные кандидата повреждены.");

  const result = await importReviewedCandidateImage({
    candidateId: candidateId.data,
    candidateAction: candidate.action,
    payload,
    organizationId: candidate.result_organization_id,
    publicationId: candidate.result_publication_id,
    uploadedBy: user.id
  });
  revalidatePath("/");
  revalidatePath("/admin/imports");
  revalidatePath(`/admin/imports/${candidateId.data}`);
  revalidatePath("/organizations");
  return result.status === "warning"
    ? actionError(`Изображение не импортировано: ${result.message}`)
    : actionSuccess(result.status === "unchanged"
      ? "Изображение уже актуально, повторная загрузка не потребовалась."
      : "Изображение импортировано и связано с материалом.");
}

export async function createContentSourceAction(
  _state: ContentIngestionActionState,
  formData: FormData
): Promise<ContentIngestionActionState> {
  const parsed = sourceSchema.safeParse({
    name: getString(formData, "name"),
    url: getString(formData, "url"),
    kind: getString(formData, "kind"),
    trustLevel: getString(formData, "trustLevel"),
    organizationId: getString(formData, "organizationId"),
    fetchIntervalMinutes: getString(formData, "fetchIntervalMinutes"),
    notes: getString(formData, "notes"),
    activateAfterTest: formData.get("activateAfterTest") === "on"
  });
  if (!parsed.success) {
    const fieldErrors = mappedSourceErrors(parsed.error);
    return actionError("Проверьте отмеченные поля источника.", fieldErrors, "source");
  }

  let canonicalUrl: string;
  try {
    canonicalUrl = normalizeSourceUrl(parsed.data.url);
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "URL источника запрещён.",
      { url: "Источник должен иметь публичный HTTPS-адрес." },
      "source"
    );
  }
  const { supabase, user } = await getAdminContext();
  if (parsed.data.organizationId) {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", parsed.data.organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (organizationError || !organization) {
      return actionError(
        "Выбранная организация больше не доступна.",
        { organizationId: "Выберите действующую организацию из списка." },
        "source"
      );
    }
  }
  const { data: exclusions, error: exclusionsError } = await supabase
    .from("content_ingestion_domain_exclusions")
    .select("domain");
  if (exclusionsError) return actionError("Не получилось проверить исключённые домены.", undefined, "source");
  if (isUrlExcludedByDomain(canonicalUrl, (exclusions ?? []).map((item) => item.domain))) {
    return actionError(
      "Этот домен исключён из импорта. Сначала удалите его из списка исключений.",
      { url: "Импорт с этого домена запрещён." },
      "source"
    );
  }
  const { data: source, error } = await supabase.from("content_sources").insert({
    name: parsed.data.name,
    kind: parsed.data.kind,
    url: parsed.data.url,
    canonical_url: canonicalUrl,
    trust_level: parsed.data.trustLevel,
    organization_id: parsed.data.organizationId || null,
    fetch_interval_minutes: parsed.data.fetchIntervalMinutes,
    notes: optionalText(parsed.data.notes),
    is_active: false,
    created_by: user.id
  }).select("id").single();
  if (error || !source) {
    return actionError(
      error?.code === "23505" ? "Такой источник уже добавлен." : "Не получилось добавить источник.",
      error?.code === "23505" ? { url: "Источник с таким адресом уже существует." } : undefined,
      "source"
    );
  }

  try {
    const result = await processContentIngestionRequest({
      sourceId: source.id,
      trigger: "admin",
      actorId: user.id
    });
    const adapterIsApproved = Boolean(
      result.adapterId
      && result.extractionFormat
      && result.extractionFormat !== "unknown"
    );
    if (parsed.data.activateAfterTest && adapterIsApproved) {
      const { error: activateError } = await supabase
        .from("content_sources")
        .update({ is_active: true, next_check_at: new Date().toISOString() })
        .eq("id", source.id);
      if (activateError) {
        revalidatePath("/admin/imports");
        return actionError(
          "Источник проверен и сохранён, но включить регулярный импорт не удалось.",
          undefined,
          "source"
        );
      }
    }
    revalidatePath("/admin/imports");
    const activationMessage = parsed.data.activateAfterTest
      ? adapterIsApproved
        ? "Регулярный импорт включён."
        : "Утверждённый адаптер не найден, поэтому источник оставлен выключенным."
      : "Источник оставлен выключенным до ручного включения.";
    return actionSuccess(
      `Источник проверен через ${result.adapterId ?? "неизвестный обработчик"}. Новых кандидатов: ${result.createdCount}. ${activationMessage}`,
      { intent: "source" }
    );
  } catch (testError) {
    revalidatePath("/admin/imports");
    return actionError(
      `Источник сохранён выключенным. Проверка завершилась ошибкой: ${translatedIngestionError(testError instanceof Error ? testError : null)}`,
      undefined,
      "source"
    );
  }
}

export async function createContentIngestionDomainExclusionAction(
  _state: ContentIngestionActionState,
  formData: FormData
): Promise<ContentIngestionActionState> {
  let domain: string;
  try {
    domain = normalizeExcludedDomain(getString(formData, "domain"));
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "Некорректный домен.",
      { domain: "Укажите домен без протокола, пути и маски." },
      "source"
    );
  }

  const { supabase, user } = await getAdminContext();
  const { error } = await supabase.from("content_ingestion_domain_exclusions").insert({
    domain,
    created_by: user.id
  });
  if (error) {
    return actionError(
      error.code === "23505" ? "Этот домен уже исключён." : "Не получилось исключить домен.",
      error.code === "23505" ? { domain: "Этот домен уже есть в списке исключений." } : undefined,
      "source"
    );
  }
  revalidatePath("/admin/imports");
  return actionSuccess(`Импорт с ${domain} и его поддоменов остановлен.`);
}

export async function deleteContentIngestionDomainExclusionAction(formData: FormData) {
  const exclusionId = postgresUuidSchema.safeParse(getString(formData, "exclusionId"));
  if (!exclusionId.success) return;
  const { supabase } = await getAdminContext();
  const { error } = await supabase
    .from("content_ingestion_domain_exclusions")
    .delete()
    .eq("id", exclusionId.data);
  if (error) throw new Error("Не получилось снова разрешить импорт с домена.");
  revalidatePath("/admin/imports");
}

export async function updateContentSourceAction(
  _state: ContentIngestionActionState,
  formData: FormData
): Promise<ContentIngestionActionState> {
  const parsed = sourceSettingsSchema.safeParse({
    sourceId: getString(formData, "sourceId"),
    organizationId: getString(formData, "organizationId"),
    fetchIntervalMinutes: getString(formData, "fetchIntervalMinutes"),
    notes: getString(formData, "notes"),
    intent: getString(formData, "intent")
  });
  if (!parsed.success) {
    const fieldErrors = mappedSourceErrors(parsed.error);
    return actionError("Проверьте настройки источника.", fieldErrors, "source");
  }
  const { supabase, user } = await getAdminContext();
  if (parsed.data.organizationId) {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", parsed.data.organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (organizationError || !organization) {
      return actionError(
        "Выбранная организация больше не доступна.",
        { organizationId: "Выберите действующую организацию из списка." },
        "source"
      );
    }
  }
  const { data: source, error: updateError } = await supabase.from("content_sources").update({
    organization_id: parsed.data.organizationId || null,
    fetch_interval_minutes: parsed.data.fetchIntervalMinutes,
    notes: optionalText(parsed.data.notes)
  }).eq("id", parsed.data.sourceId).select("id, is_active, adapter_id, extraction_format").maybeSingle();
  if (updateError || !source) {
    return actionError("Не удалось сохранить настройки источника.", undefined, "source");
  }

  let testedAdapterId = source.adapter_id;
  let testedFormat = source.extraction_format;
  if (
    parsed.data.intent === "test"
    || parsed.data.intent === "enable"
  ) {
    try {
      const result = await processContentIngestionRequest({
        sourceId: source.id,
        trigger: "admin",
        actorId: user.id
      });
      testedAdapterId = result.adapterId;
      testedFormat = result.extractionFormat;
    } catch (testError) {
      revalidatePath("/admin/imports");
      return actionError(
        translatedIngestionError(testError instanceof Error ? testError : null),
        undefined,
        "source"
      );
    }
  }

  if (parsed.data.intent === "enable") {
    if (!testedAdapterId || !testedFormat || testedFormat === "unknown") {
      return actionError(
        "Регулярный импорт нельзя включить: для источника нет утверждённого обработчика.",
        undefined,
        "source"
      );
    }
    const { error } = await supabase.from("content_sources").update({
      is_active: true,
      next_check_at: new Date().toISOString()
    }).eq("id", source.id);
    if (error) return actionError("Не удалось включить источник.", undefined, "source");
  } else if (parsed.data.intent === "disable") {
    const { error } = await supabase.from("content_sources").update({ is_active: false }).eq("id", source.id);
    if (error) return actionError("Не удалось приостановить источник.", undefined, "source");
  }

  revalidatePath("/admin/imports");
  const message = parsed.data.intent === "test"
    ? `Проверка завершена через ${testedAdapterId ?? "неизвестный обработчик"}.`
    : parsed.data.intent === "enable"
      ? "Регулярный импорт включён."
      : parsed.data.intent === "disable"
        ? "Регулярный импорт приостановлен."
        : "Настройки источника сохранены.";
  return actionSuccess(message, { intent: "source" });
}

export async function enqueueManualUrlAction(
  _state: ContentIngestionActionState,
  formData: FormData
): Promise<ContentIngestionActionState> {
  const url = getString(formData, "url");
  if (!url.trim()) {
    return actionError("Укажите URL для проверки.", { url: "Введите публичный HTTPS-адрес." }, "manual_url");
  }
  const { user } = await getAdminContext();
  try {
    const result = await processContentIngestionRequest({ url, trigger: "admin", actorId: user.id });
    revalidatePath("/admin/imports");
    return actionSuccess(
      `Проверка завершена через ${result.adapterId ?? "неизвестный обработчик"}: новых кандидатов — ${result.createdCount}, дублей — ${result.duplicateCount}.`,
      { intent: "manual_url" }
    );
  } catch (error) {
    return actionError(
      translatedIngestionError(error instanceof Error ? error : null),
      { url: "Проверьте доступность и формат страницы." },
      "manual_url"
    );
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
    return actionSuccess(
      `Проверено источников: ${result.processed}; новых кандидатов: ${result.created}; ошибок: ${result.failed}.`,
      { intent: "run" }
    );
  } catch (error) {
    return actionError(translatedIngestionError(error instanceof Error ? error : null), undefined, "run");
  }
}
