import type { Tables } from "@/shared/api/supabase/database.types";
import type {
  ContentCandidateEvidence,
  ContentCandidatePayload,
  OrganizationCandidatePayload
} from "@/features/content-ingestion/model/contracts";
import type { ContentCandidateFormIntent } from "@/features/content-ingestion/model/candidate-form";

export const adminContentCandidateFilters = [
  "pending",
  "duplicate",
  "approved",
  "rejected",
  "stale",
  "failed",
  "all"
] as const;

export type AdminContentCandidateFilter = (typeof adminContentCandidateFilters)[number];

export const contentCandidateStatusLabels = {
  pending: "Ожидает проверки",
  approved: "Одобрено",
  rejected: "Отклонено",
  duplicate: "Возможный дубль",
  stale: "Устарело",
  failed: "Ошибка"
} as const;

export const contentCandidateActionLabels = {
  create_organization: "Новая организация",
  create_publication: "Новая публикация",
  update_publication: "Обновление публикации",
  cancel_publication: "Отмена публикации"
} as const;

export type ContentSourceRow = Tables<"content_sources">;
export type ContentIngestionDomainExclusionRow = Tables<"content_ingestion_domain_exclusions">;
export type ContentIngestionRunRow = Tables<"content_ingestion_runs">;
export type ContentCandidateRow = Tables<"content_candidates">;

export type ContentCandidateListItem = ContentCandidateRow & {
  content_sources: Pick<
    ContentSourceRow,
    "id" | "name" | "url" | "trust_level" | "adapter_id" | "organization_id"
  > | null;
};

export type ContentCandidateDetail = ContentCandidateListItem & {
  content_ingestion_runs: Pick<ContentIngestionRunRow, "id" | "status" | "trigger" | "started_at" | "finished_at"> | null;
  duplicate_candidate: Pick<ContentCandidateRow, "id" | "action" | "payload" | "status"> | null;
  duplicate_publication: Pick<Tables<"publications">, "id" | "slug" | "title" | "status"> | null;
  duplicate_organization: Pick<Tables<"organizations">, "id" | "slug" | "name" | "status"> | null;
  dependency_candidate: Pick<
    ContentCandidateRow,
    "id" | "action" | "payload" | "status" | "result_organization_id" | "updated_at"
  > | null;
  parsedPayload: ContentCandidatePayload;
  parsedDependencyOrganization: OrganizationCandidatePayload | null;
  parsedEvidence: ContentCandidateEvidence[];
};

export type ContentIngestionActionState = {
  status: "idle" | "success" | "error";
  message: string;
  intent?: ContentCandidateFormIntent | "source" | "manual_url" | "run";
  fieldErrors?: Record<string, string>;
  updatedAt?: string;
  dependencyUpdatedAt?: string;
};

export const initialContentIngestionActionState: ContentIngestionActionState = {
  status: "idle",
  message: ""
};

export type PagedContentCandidates = {
  items: ContentCandidateListItem[];
  page: number;
  pageSize: number;
  total: number;
  filters: {
    status: AdminContentCandidateFilter;
    action: string;
    sourceId: string;
    hasWarnings: boolean;
  };
};

export function parseContentCandidateFilter(value: unknown): AdminContentCandidateFilter {
  return typeof value === "string" && adminContentCandidateFilters.includes(value as AdminContentCandidateFilter)
    ? value as AdminContentCandidateFilter
    : "pending";
}

export function getCandidateTitle(payload: ContentCandidatePayload) {
  return payload.kind === "organization" ? payload.name : payload.title;
}

export function getCandidateOrganizationName(payload: ContentCandidatePayload) {
  return payload.kind === "organization" ? payload.name : payload.organizationName;
}
