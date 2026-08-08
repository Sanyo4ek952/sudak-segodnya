import { randomUUID } from "node:crypto";
import {
  contentCandidatePayloadSchema,
  getCandidatePublishWarnings,
  organizationCandidatePayloadSchema,
  type ContentCandidateEvidence,
  type ContentCandidatePayload,
  type ContentIngestionTrigger,
  type ExtractedCandidate,
  type OrganizationCandidatePayload,
  type PublicationCandidatePayload
} from "@/features/content-ingestion/model/contracts";
import {
  createContentFingerprint,
  createContentHash,
  sha256
} from "@/features/content-ingestion/model/fingerprint";
import { isUrlExcludedByDomain } from "@/features/content-ingestion/model/domain-exclusion";
import {
  classifyCandidateTemporalState,
  hasExplicitCancellationEvidence,
  selectOrganizationEvidence
} from "@/features/content-ingestion/model/candidate-rules";
import {
  applyOrganizationDefaults,
  createOrganizationIdentityKey,
  normalizeOrganizationName,
  resolveImportOrganization,
  type ImportOrganization
} from "@/features/content-ingestion/model/organization-resolution";
import { resolvePublicationFollowup } from "@/features/content-ingestion/model/publication-followup";
import { extractSourceCandidates } from "@/features/content-ingestion/server/official-source-adapters";
import {
  fetchPublicSource,
  normalizeSourceUrl
} from "@/features/content-ingestion/server/secure-fetch";
import { createSupabaseAdminClient } from "@/shared/api/supabase/admin";
import type { Tables } from "@/shared/api/supabase/database.types";

type ContentSource = Tables<"content_sources">;

type OrganizationResolutionContext = {
  activeOrganizations: ImportOrganization[];
  pendingOrganizations: Map<string, string>;
};

type ProcessRequest = {
  sourceId?: string;
  url?: string;
  trigger: ContentIngestionTrigger;
  actorId?: string | null;
};

export type ProcessContentIngestionResult = {
  runId: string;
  discoveredCount: number;
  createdCount: number;
  duplicateCount: number;
  failedCount: number;
  notModified: boolean;
  adapterId: string | null;
  extractionFormat: "rss" | "json_ld" | "adapter" | "unknown" | null;
};

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Неизвестная ошибка сбора.";
  return message.replace(/[\u0000-\u001f\u007f]+/g, " ").slice(0, 1000);
}

async function getExcludedDomains() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("content_ingestion_domain_exclusions")
    .select("domain");
  if (error) throw new Error("Не получилось проверить исключённые домены.");
  return (data ?? []).map((item) => item.domain);
}

function assertDomainAllowed(url: string, excludedDomains: readonly string[]) {
  if (isUrlExcludedByDomain(url, excludedDomains)) {
    throw new Error("Домен источника исключён из импорта администратором.");
  }
}

function categoryToOrganizationType(categorySlug: string) {
  if (categorySlug === "kids") return "kids";
  if (categorySlug === "culture") return "culture";
  if (categorySlug === "excursions") return "excursions";
  if (categorySlug === "rental") return "rental_entertainment";
  if (categorySlug === "shops") return "shops";
  if (categorySlug === "food") return "food";
  return "services";
}

function compactExcerpt(value: string) {
  return value.slice(0, 20_000);
}

function verifyEvidence(
  evidence: ContentCandidateEvidence[],
  sourceText: string,
  sourceUrl: string
) {
  const normalizedText = sourceText.normalize("NFKC").toLocaleLowerCase("ru-RU");
  const warnings: string[] = [];
  const verified = evidence.filter((item) => {
    const excerptPresent = normalizedText.includes(item.excerpt.normalize("NFKC").toLocaleLowerCase("ru-RU"));
    let sourceMatches = false;
    try {
      sourceMatches = normalizeSourceUrl(item.sourceUrl) === normalizeSourceUrl(sourceUrl);
    } catch {
      sourceMatches = false;
    }
    if (!excerptPresent) warnings.push(`Доказательство для поля «${item.field}» не найдено в тексте источника.`);
    if (!sourceMatches) warnings.push(`Доказательство для поля «${item.field}» ссылается на другой URL.`);
    return excerptPresent && sourceMatches;
  });
  return { verified, warnings };
}

async function findOrganizationMatches(
  organizationName: string,
  organizations: ImportOrganization[]
) {
  const target = normalizeOrganizationName(organizationName);
  return organizations.filter(
    (organization) => normalizeOrganizationName(organization.name) === target
  );
}

async function findOpenOrganizationCandidate(organizationIdentityKey: string) {
  const admin = createSupabaseAdminClient();
  for (const status of ["pending", "duplicate"] as const) {
    const { data, error } = await admin
      .from("content_candidates")
      .select("id")
      .eq("action", "create_organization")
      .eq("organization_identity_key", organizationIdentityKey)
      .eq("status", status)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Не получилось проверить открытого кандидата организации.");
    if (data) return data.id;
  }
  return null;
}

async function createOrganizationResolutionContext(): Promise<OrganizationResolutionContext> {
  const admin = createSupabaseAdminClient();
  const [organizationsResult, candidatesResult] = await Promise.all([
    admin.from("organizations").select("id, name, address, phone").eq("status", "active"),
    admin.from("content_candidates")
      .select("id, organization_identity_key, status, created_at")
      .eq("action", "create_organization")
      .in("status", ["pending", "duplicate"])
      .not("organization_identity_key", "is", null)
      .order("created_at", { ascending: true })
  ]);
  if (organizationsResult.error || candidatesResult.error) {
    throw new Error("Не получилось подготовить сопоставление организаций.");
  }

  const pendingOrganizations = new Map<string, string>();
  for (const status of ["pending", "duplicate"] as const) {
    for (const candidate of candidatesResult.data ?? []) {
      if (
        candidate.status === status
        && candidate.organization_identity_key
        && !pendingOrganizations.has(candidate.organization_identity_key)
      ) {
        pendingOrganizations.set(candidate.organization_identity_key, candidate.id);
      }
    }
  }
  return {
    activeOrganizations: (organizationsResult.data ?? []) as ImportOrganization[],
    pendingOrganizations
  };
}

async function findCrossSourceDuplicate(
  fingerprint: string,
  sourceUrl: string
) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("content_candidates")
    .select("id")
    .eq("normalized_fingerprint", fingerprint)
    .neq("source_url", sourceUrl)
    .in("status", ["pending", "approved", "duplicate"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function findSameSourceCandidate(
  fingerprint: string,
  sourceUrl: string,
  action: ExtractedCandidate["action"],
  externalId: string | null
) {
  const admin = createSupabaseAdminClient();
  let identityQuery = admin
    .from("content_candidates")
    .select("id, status, content_hash, source_version_hash")
    .eq("source_url", sourceUrl)
    .eq("action", action)
    .in("status", ["pending", "duplicate", "stale"])
    .order("created_at", { ascending: false })
    .limit(1);
  identityQuery = externalId
    ? identityQuery.eq("external_id", externalId)
    : identityQuery.is("external_id", null);
  const { data: identity } = await identityQuery.maybeSingle();
  if (identity) return identity;

  const { data: fingerprintMatch } = await admin
    .from("content_candidates")
    .select("id, status, content_hash, source_version_hash")
    .eq("normalized_fingerprint", fingerprint)
    .eq("source_url", sourceUrl)
    .eq("action", action)
    .in("status", ["pending", "duplicate", "stale"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return fingerprintMatch ?? null;
}

async function findLatestApprovedPublicationCandidate(
  sourceUrl: string,
  externalId: string | null
) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("content_candidates")
    .select("id, action, source_version_hash, result_publication_id, target_organization_id")
    .eq("source_url", sourceUrl)
    .eq("status", "approved")
    .in("action", ["create_publication", "update_publication", "cancel_publication"])
    .not("result_publication_id", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(1);
  query = externalId
    ? query.eq("external_id", externalId)
    : query.is("external_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Не получилось проверить историю импортированной публикации.");
  return data;
}

async function findPublicationDuplicate(payload: PublicationCandidatePayload) {
  if (!payload.organizationId) return null;
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("publications")
    .select("id")
    .eq("organization_id", payload.organizationId)
    .eq("title", payload.title)
    .in("status", ["draft", "scheduled", "published", "cancelled"]);
  if (payload.startsAt) query = query.eq("starts_at", payload.startsAt);
  else if (payload.validUntil) query = query.eq("valid_until", payload.validUntil);
  else return null;
  const { data } = await query.limit(1).maybeSingle();
  return data?.id ?? null;
}

async function findTargetPublication(payload: PublicationCandidatePayload) {
  if (payload.targetPublicationId) return { id: payload.targetPublicationId, ambiguous: false };
  if (!payload.organizationId) return { id: null, ambiguous: false };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("publications")
    .select("id, title, starts_at, valid_until")
    .eq("organization_id", payload.organizationId)
    .in("status", ["draft", "scheduled", "published"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Не получилось сопоставить целевую публикацию.");
  const normalizedTitle = normalizeOrganizationName(payload.title);
  let matches = (data ?? []).filter((publication) => (
    normalizeOrganizationName(publication.title) === normalizedTitle
  ));
  const targetDate = payload.startsAt ?? payload.validUntil;
  if (matches.length > 1 && targetDate) {
    const targetTime = Date.parse(targetDate);
    matches = matches.filter((publication) => {
      const value = publication.starts_at ?? publication.valid_until;
      return value ? Date.parse(value) === targetTime : false;
    });
  }
  return {
    id: matches.length === 1 ? matches[0].id : null,
    ambiguous: matches.length > 1
  };
}

async function insertCandidate({
  runId,
  source,
  sourceUrl,
  sourceCheckedAt,
  candidate,
  payload,
  evidence,
  warnings,
  sourceExcerpt,
  dependsOnCandidateId,
  sourceVersionHash,
  status
}: {
  runId: string;
  source: ContentSource | null;
  sourceUrl: string;
  sourceCheckedAt: string;
  candidate: ExtractedCandidate;
  payload: ContentCandidatePayload;
  evidence: ContentCandidateEvidence[];
  warnings: string[];
  sourceExcerpt: string;
  dependsOnCandidateId?: string | null;
  sourceVersionHash?: string;
  status?: "pending" | "duplicate" | "stale" | "failed";
}) {
  const admin = createSupabaseAdminClient();
  const organizationIdentityKey = payload.kind === "organization"
    ? createOrganizationIdentityKey(payload.name)
    : null;
  if (organizationIdentityKey) {
    const existingOrganizationCandidateId = await findOpenOrganizationCandidate(organizationIdentityKey);
    if (existingOrganizationCandidateId) {
      await admin.from("content_candidates")
        .update({ last_seen_at: sourceCheckedAt })
        .eq("id", existingOrganizationCandidateId);
      return { id: existingOrganizationCandidateId, created: false, duplicate: true };
    }
  }
  const contentHash = createContentHash({ action: candidate.action, payload, evidence });
  const stableSourceVersionHash = sourceVersionHash ?? contentHash;
  const fingerprint = createContentFingerprint(payload);
  const sameSourceCandidate = await findSameSourceCandidate(
    fingerprint,
    sourceUrl,
    candidate.action,
    candidate.externalId
  );
  if (sameSourceCandidate) {
    const refreshable = sameSourceCandidate.status === "pending"
      || sameSourceCandidate.status === "duplicate"
      || sameSourceCandidate.status === "stale";
    const refreshPayload = refreshable && (
      sameSourceCandidate.content_hash !== contentHash
      || sameSourceCandidate.source_version_hash !== stableSourceVersionHash
    );
    const { error } = await admin.from("content_candidates").update(refreshPayload ? {
      payload,
      evidence,
      warnings,
      source_checked_at: sourceCheckedAt,
      external_id: candidate.externalId,
      content_hash: contentHash,
      normalized_fingerprint: fingerprint,
      target_organization_id: payload.kind === "publication" ? payload.organizationId : null,
      target_publication_id: payload.kind === "publication" ? payload.targetPublicationId : null,
      source_excerpt: sourceExcerpt,
      source_version_hash: stableSourceVersionHash,
      raw_expires_at: new Date(Date.parse(sourceCheckedAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_seen_at: sourceCheckedAt
    } : {
      last_seen_at: sourceCheckedAt
    }).eq("id", sameSourceCandidate.id);
    if (error) throw new Error("Не получилось обновить повторно найденного кандидата.");
    return { id: sameSourceCandidate.id, created: false, duplicate: true };
  }
  const duplicateCandidateId = await findCrossSourceDuplicate(fingerprint, sourceUrl);
  const duplicatePublicationId = payload.kind === "publication" && candidate.action === "create_publication"
    ? await findPublicationDuplicate(payload)
    : null;
  const finalStatus = status ?? (duplicateCandidateId || duplicatePublicationId ? "duplicate" : "pending");
  const { data, error } = await admin.from("content_candidates").insert({
    source_id: source?.id ?? null,
    run_id: runId,
    depends_on_candidate_id: dependsOnCandidateId ?? null,
    action: candidate.action,
    status: finalStatus,
    payload,
    evidence,
    warnings,
    source_url: sourceUrl,
    source_checked_at: sourceCheckedAt,
    external_id: candidate.externalId,
    content_hash: contentHash,
    source_version_hash: stableSourceVersionHash,
    normalized_fingerprint: fingerprint,
    organization_identity_key: organizationIdentityKey,
    duplicate_of_id: duplicateCandidateId,
    duplicate_publication_id: duplicatePublicationId,
    target_organization_id: payload.kind === "publication" ? payload.organizationId : null,
    target_publication_id: payload.kind === "publication" ? payload.targetPublicationId : null,
    source_excerpt: sourceExcerpt
  }).select("id, status").single();

  if (error?.code === "23505") {
    if (organizationIdentityKey) {
      const existingOrganizationCandidateId = await findOpenOrganizationCandidate(organizationIdentityKey);
      if (existingOrganizationCandidateId) {
        await admin.from("content_candidates")
          .update({ last_seen_at: sourceCheckedAt })
          .eq("id", existingOrganizationCandidateId);
        return { id: existingOrganizationCandidateId, created: false, duplicate: true };
      }
    }
    let existingQuery = admin
      .from("content_candidates")
      .select("id, status")
      .eq("source_url", sourceUrl)
      .eq("content_hash", contentHash)
      .limit(1);
    existingQuery = candidate.externalId
      ? existingQuery.eq("external_id", candidate.externalId)
      : existingQuery.is("external_id", null);
    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) {
      await admin.from("content_candidates").update({ last_seen_at: sourceCheckedAt }).eq("id", existing.id);
    }
    return { id: existing?.id ?? null, created: false, duplicate: true };
  }
  if (error || !data) throw new Error("Не получилось сохранить кандидата в закрытую очередь.");
  return { id: data.id, created: true, duplicate: data.status === "duplicate" };
}

async function createMissingOrganizationCandidate({
  runId,
  source,
  sourceUrl,
  sourceCheckedAt,
  sourceExcerpt,
  publication,
  evidence
}: {
  runId: string;
  source: ContentSource | null;
  sourceUrl: string;
  sourceCheckedAt: string;
  sourceExcerpt: string;
  publication: PublicationCandidatePayload;
  evidence: ContentCandidateEvidence[];
}) {
  const payload: OrganizationCandidatePayload = organizationCandidatePayloadSchema.parse({
    kind: "organization",
    name: publication.organizationName,
    typeSlug: categoryToOrganizationType(publication.categorySlug),
    description: null,
    address: publication.place,
    phone: publication.contactPhone,
    workingHours: null,
    contactLinks: [],
    imageSourceUrl: null
  });
  const candidate: ExtractedCandidate = {
    action: "create_organization",
    externalId: null,
    payload,
    evidence: selectOrganizationEvidence(evidence),
    warnings: [
      "Организация не найдена в базе. Проверьте её отдельно перед публикацией связанных материалов.",
      ...getCandidatePublishWarnings(payload)
    ]
  };
  return insertCandidate({
    runId,
    source,
    sourceUrl,
    sourceCheckedAt,
    candidate,
    payload,
    evidence: candidate.evidence,
    warnings: candidate.warnings,
    sourceExcerpt
  });
}

async function processExtractedCandidates({
  runId,
  source,
  sourceUrl,
  sourceText,
  checkedAt,
  candidates,
  organizationContext
}: {
  runId: string;
  source: ContentSource | null;
  sourceUrl: string;
  sourceText: string;
  checkedAt: Date;
  candidates: ExtractedCandidate[];
  organizationContext: OrganizationResolutionContext;
}) {
  const admin = createSupabaseAdminClient();

  let createdCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  const sourceExcerpt = compactExcerpt(sourceText);
  const { activeOrganizations, pendingOrganizations } = organizationContext;

  for (const extracted of candidates.filter((item) => item.payload.kind === "organization")) {
    try {
      const payload = extracted.payload as OrganizationCandidatePayload;
      const organizationIdentityKey = createOrganizationIdentityKey(payload.name);
      const sourceOrganization = source?.organization_id
        ? activeOrganizations.find((organization) => organization.id === source.organization_id) ?? null
        : null;
      const matches = sourceOrganization
        ? [sourceOrganization]
        : await findOrganizationMatches(payload.name, activeOrganizations);
      if (matches.length === 1) {
        duplicateCount += 1;
        continue;
      }
      if (pendingOrganizations.has(organizationIdentityKey)) {
        duplicateCount += 1;
        continue;
      }
      const checkedEvidence = verifyEvidence(extracted.evidence, sourceText, sourceUrl);
      if (checkedEvidence.verified.length === 0) {
        checkedEvidence.warnings.push("Нет проверенного фрагмента-доказательства из первичного источника.");
      }
      const result = await insertCandidate({
        runId,
        source,
        sourceUrl,
        sourceCheckedAt: checkedAt.toISOString(),
        candidate: extracted,
        payload,
        evidence: checkedEvidence.verified,
        warnings: [...extracted.warnings, ...checkedEvidence.warnings, ...getCandidatePublishWarnings(payload)],
        sourceExcerpt
      });
      if (result.created) createdCount += 1;
      else duplicateCount += 1;
      if (result.id) pendingOrganizations.set(organizationIdentityKey, result.id);
    } catch {
      failedCount += 1;
    }
  }

  for (const extracted of candidates.filter((item) => item.payload.kind === "publication")) {
    try {
      const originalPayload = extracted.payload as PublicationCandidatePayload;
      const previousApproved = extracted.action === "create_publication"
        ? await findLatestApprovedPublicationCandidate(sourceUrl, extracted.externalId)
        : null;
      let resolution = resolveImportOrganization({
        payload: originalPayload,
        sourceOrganizationId: source?.organization_id ?? null,
        organizations: activeOrganizations
      });
      const checkedEvidence = verifyEvidence(extracted.evidence, sourceText, sourceUrl);
      const warnings = [...extracted.warnings, ...checkedEvidence.warnings];
      const sourceVersionHash = createContentHash({
        payload: originalPayload,
        evidence: checkedEvidence.verified
      });
      if (previousApproved && !previousApproved.source_version_hash) {
        const { error: baselineError } = await admin
          .from("content_candidates")
          .update({
            source_version_hash: sourceVersionHash,
            last_seen_at: checkedAt.toISOString()
          })
          .eq("id", previousApproved.id);
        if (baselineError) throw new Error("Не получилось сохранить версию первичного источника.");
        duplicateCount += 1;
        continue;
      }
      if (previousApproved?.source_version_hash === sourceVersionHash) {
        const { error: seenError } = await admin
          .from("content_candidates")
          .update({ last_seen_at: checkedAt.toISOString() })
          .eq("id", previousApproved.id);
        if (seenError) throw new Error("Не получилось обновить время последней проверки материала.");
        duplicateCount += 1;
        continue;
      }
      if (checkedEvidence.verified.length === 0) {
        warnings.push("Нет проверенного фрагмента-доказательства из первичного источника.");
      }
      let dependsOnCandidateId: string | null = null;
      let organizationId: string | null = null;

      if (!resolution.organization && previousApproved?.target_organization_id) {
        const previousOrganization = activeOrganizations.find(
          (organization) => organization.id === previousApproved.target_organization_id
        );
        if (previousOrganization) {
          resolution = {
            organization: previousOrganization,
            reason: "candidate_binding",
            suggestions: resolution.suggestions
          };
          warnings.push("Организация взята из последней одобренной версии этой публикации.");
        }
      }

      if (resolution.organization) {
        organizationId = resolution.organization.id;
        if (resolution.reason === "source_binding") {
          warnings.push("Организация определена по явной привязке источника.");
        } else if (resolution.reason === "exact_name") {
          warnings.push("Организация автоматически сопоставлена по точному названию.");
        }
      } else {
        if (resolution.suggestions.length > 0) {
          warnings.push(
            `Найдены похожие организации: ${resolution.suggestions.map((item) => item.name).join(", ")}. Подтвердите выбор вручную.`
          );
        }
        dependsOnCandidateId = pendingOrganizations.get(
          createOrganizationIdentityKey(originalPayload.organizationName)
        ) ?? null;
        if (!dependsOnCandidateId) {
          const dependency = await createMissingOrganizationCandidate({
            runId,
            source,
            sourceUrl,
            sourceCheckedAt: checkedAt.toISOString(),
            sourceExcerpt,
            publication: originalPayload,
            evidence: checkedEvidence.verified
          });
          dependsOnCandidateId = dependency.id;
          if (dependency.created) createdCount += 1;
          else duplicateCount += 1;
          if (dependency.id) {
            pendingOrganizations.set(
              createOrganizationIdentityKey(originalPayload.organizationName),
              dependency.id
            );
          }
        }
        warnings.push("Публикация ожидает решения по новой организации.");
      }

      let effectiveCandidate = extracted;
      let targetPublicationId = originalPayload.targetPublicationId;
      const cancellationConfirmed = hasExplicitCancellationEvidence(checkedEvidence.verified);
      const followup = resolvePublicationFollowup({
        incomingAction: extracted.action,
        previousAction: previousApproved?.action ?? null,
        previousPublicationId: previousApproved?.result_publication_id ?? null,
        cancellationConfirmed
      });
      if (followup.skip) {
        duplicateCount += 1;
        continue;
      }
      if (followup.action !== extracted.action) {
        effectiveCandidate = {
          ...extracted,
          action: followup.action
        };
        warnings.push(followup.action === "cancel_publication"
          ? "Для ранее импортированной публикации найдена подтверждённая отмена."
          : "Изменённая версия будет предложена как обновление существующей публикации.");
      }
      targetPublicationId = followup.targetPublicationId ?? targetPublicationId;

      if (
        !targetPublicationId
        && (
          effectiveCandidate.action === "update_publication"
          || effectiveCandidate.action === "cancel_publication"
        )
      ) {
        const target = await findTargetPublication({ ...originalPayload, organizationId });
        targetPublicationId = targetPublicationId ?? target.id;
        if (!targetPublicationId) {
          warnings.push(target.ambiguous
            ? "Найдено несколько возможных целевых публикаций. Выберите одну вручную."
            : "Целевая публикация не найдена автоматически. Выберите её вручную.");
        }
      }

      const resolvedPayload = resolution.organization
        ? applyOrganizationDefaults(originalPayload, resolution.organization)
        : originalPayload;
      const parsedPayload = contentCandidatePayloadSchema.parse({
        ...resolvedPayload,
        organizationId,
        targetPublicationId
      });
      const temporalState = classifyCandidateTemporalState(parsedPayload, checkedAt);
      const payload = contentCandidatePayloadSchema.parse(temporalState.payload);
      warnings.push(...temporalState.warnings);
      warnings.push(...getCandidatePublishWarnings(payload, checkedAt));
      let forcedStatus: "stale" | "failed" | undefined;
      if (temporalState.status === "stale") forcedStatus = "stale";
      if (effectiveCandidate.action === "cancel_publication" && !cancellationConfirmed) {
        warnings.push("Отмена не подтверждена явной формулировкой первичного источника.");
        forcedStatus = "failed";
      }
      const result = await insertCandidate({
        runId,
        source,
        sourceUrl,
        sourceCheckedAt: checkedAt.toISOString(),
        candidate: effectiveCandidate,
        payload,
        evidence: checkedEvidence.verified,
        warnings: Array.from(new Set(warnings)),
        sourceExcerpt,
        dependsOnCandidateId,
        sourceVersionHash,
        status: forcedStatus
      });
      if (result.created) createdCount += 1;
      else duplicateCount += 1;
    } catch {
      failedCount += 1;
    }
  }
  return { createdCount, duplicateCount, failedCount };
}

function createRunKey(request: ProcessRequest, canonicalUrl: string) {
  const scope = request.trigger === "cron"
    ? new Date().toISOString().slice(0, 13)
    : randomUUID();
  return sha256(`${request.trigger}|${request.sourceId ?? canonicalUrl}|${scope}`);
}

export async function processContentIngestionRequest(request: ProcessRequest): Promise<ProcessContentIngestionResult> {
  if (Boolean(request.sourceId) === Boolean(request.url)) {
    throw new Error("Передайте ровно один источник или URL.");
  }
  const admin = createSupabaseAdminClient();
  let source: ContentSource | null = null;
  if (request.sourceId) {
    const { data, error } = await admin.from("content_sources").select("*").eq("id", request.sourceId).maybeSingle();
    if (error || !data) throw new Error("Источник не найден.");
    source = data;
  }
  const canonicalUrl = normalizeSourceUrl(source?.canonical_url ?? request.url ?? "");
  const excludedDomains = await getExcludedDomains();
  assertDomainAllowed(canonicalUrl, excludedDomains);
  const idempotencyKey = createRunKey(request, canonicalUrl);
  const { data: run, error: runError } = await admin.from("content_ingestion_runs").insert({
    source_id: source?.id ?? null,
    source_url: source ? null : canonicalUrl,
    trigger: request.trigger,
    status: "running",
    idempotency_key: idempotencyKey,
    created_by: request.actorId ?? null,
    started_at: new Date().toISOString()
  }).select("id").single();
  if (runError?.code === "23505") throw new Error("Этот источник уже обрабатывается в текущем окне запуска.");
  if (runError || !run) throw new Error("Не получилось создать запуск сбора.");

  try {
    await admin.from("content_candidates").update({ source_excerpt: null }).lt("raw_expires_at", new Date().toISOString());
    const hasStoredExtractionDiagnostics = Boolean(
      source?.adapter_id
      && source.extraction_format
      && source.extraction_format !== "unknown"
    );
    const fetched = await fetchPublicSource(canonicalUrl, {
      etag: hasStoredExtractionDiagnostics ? source?.etag : null,
      lastModified: hasStoredExtractionDiagnostics ? source?.last_modified : null
    });
    assertDomainAllowed(fetched.finalUrl, excludedDomains);
    if (fetched.notModified) {
      const finishedAt = new Date().toISOString();
      await admin.from("content_ingestion_runs").update({
        status: "succeeded",
        finished_at: finishedAt,
        adapter_id: source?.adapter_id ?? null,
        extraction_format: source?.extraction_format ?? null,
        final_url: fetched.finalUrl
      }).eq("id", run.id);
      if (source) await admin.from("content_sources").update({
        last_checked_at: finishedAt,
        last_success_at: finishedAt,
        last_tested_at: finishedAt,
        next_check_at: new Date(Date.parse(finishedAt) + source.fetch_interval_minutes * 60_000).toISOString(),
        consecutive_failures: 0,
        last_error: null
      }).eq("id", source.id);
      return {
        runId: run.id,
        discoveredCount: 0,
        createdCount: 0,
        duplicateCount: 0,
        failedCount: 0,
        notModified: true,
        adapterId: source?.adapter_id ?? null,
        extractionFormat: (source?.extraction_format as ProcessContentIngestionResult["extractionFormat"]) ?? null
      };
    }

    const checkedAt = new Date();
    const extraction = await extractSourceCandidates({
      fetched,
      sourceKind: source?.kind ?? null,
      sourceName: source?.name ?? null
    });
    const organizationContext = await createOrganizationResolutionContext();
    const counters = { createdCount: 0, duplicateCount: 0, failedCount: 0 };
    let discoveredCount = 0;
    for (const batch of extraction.batches) {
      assertDomainAllowed(batch.sourceUrl, excludedDomains);
      discoveredCount += batch.candidates.length;
      const batchCounters = await processExtractedCandidates({
        runId: run.id,
        source,
        sourceUrl: batch.sourceUrl,
        sourceText: batch.sourceText,
        checkedAt,
        candidates: batch.candidates,
        organizationContext
      });
      counters.createdCount += batchCounters.createdCount;
      counters.duplicateCount += batchCounters.duplicateCount;
      counters.failedCount += batchCounters.failedCount;
    }
    const finalStatus = counters.failedCount > 0 ? "partial" : "succeeded";
    const finishedAt = new Date().toISOString();
    await admin.from("content_ingestion_runs").update({
      status: finalStatus,
      finished_at: finishedAt,
      adapter_id: extraction.adapterId,
      extraction_format: extraction.format,
      final_url: fetched.finalUrl,
      discovered_count: discoveredCount,
      created_count: counters.createdCount,
      duplicate_count: counters.duplicateCount,
      failed_count: counters.failedCount
    }).eq("id", run.id);
    if (source) await admin.from("content_sources").update({
      url: fetched.finalUrl,
      canonical_url: fetched.finalUrl,
      etag: fetched.etag,
      last_modified: fetched.lastModified,
      adapter_id: extraction.adapterId,
      extraction_format: extraction.format,
      is_active: extraction.format === "unknown" ? false : source.is_active,
      last_checked_at: finishedAt,
      last_success_at: finishedAt,
      last_tested_at: finishedAt,
      next_check_at: new Date(Date.parse(finishedAt) + source.fetch_interval_minutes * 60_000).toISOString(),
      consecutive_failures: 0,
      last_error: null
    }).eq("id", source.id);
    return {
      runId: run.id,
      discoveredCount,
      ...counters,
      notModified: false,
      adapterId: extraction.adapterId,
      extractionFormat: extraction.format
    };
  } catch (error) {
    const message = safeErrorMessage(error);
    const finishedAt = new Date().toISOString();
    await admin.from("content_ingestion_runs").update({
      status: "failed",
      finished_at: finishedAt,
      failed_count: 1,
      error_message: message
    }).eq("id", run.id);
    if (source) await admin.from("content_sources").update({
      last_checked_at: finishedAt,
      last_error_at: finishedAt,
      last_tested_at: finishedAt,
      next_check_at: new Date(Date.parse(finishedAt) + source.fetch_interval_minutes * 60_000).toISOString(),
      consecutive_failures: source.consecutive_failures + 1,
      last_error: message
    }).eq("id", source.id);
    throw new Error(message);
  }
}

export async function runScheduledContentIngestion({
  trigger,
  actorId,
  force = false
}: {
  trigger: "cron" | "admin";
  actorId?: string | null;
  force?: boolean;
}) {
  const admin = createSupabaseAdminClient();
  const sourceResult = force
    ? await admin.from("content_sources").select("*").eq("is_active", true).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(5)
    : await admin.rpc("claim_due_content_sources", { p_limit: 5 });
  if (sourceResult.error) throw new Error("Не получилось получить список источников для запуска.");

  const excludedDomains = await getExcludedDomains();
  const sources = (sourceResult.data ?? []).filter((source) =>
    !isUrlExcludedByDomain(source.canonical_url, excludedDomains)
  );

  const results = await Promise.all(sources.map(async (source) => {
    try {
      const result = await processContentIngestionRequest({ sourceId: source.id, trigger, actorId });
      return { created: result.createdCount, failed: 0 };
    } catch {
      return { created: 0, failed: 1 };
    }
  }));
  const created = results.reduce((total, result) => total + result.created, 0);
  const failed = results.reduce((total, result) => total + result.failed, 0);
  return { processed: sources.length, created, failed };
}
