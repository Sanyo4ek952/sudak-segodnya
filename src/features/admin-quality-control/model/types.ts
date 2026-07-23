import type { Tables } from "@/shared/api/supabase/database.types";

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialAdminActionState: AdminActionState = {
  status: "idle",
  message: ""
};

export const adminPublicationFilters = [
  "published",
  "cancelled",
  "hidden",
  "blocked",
  "all"
] as const;

export const adminOrganizationFilters = ["active", "pending", "blocked", "all"] as const;
export const adminReportFilters = ["new", "reviewing", "resolved", "rejected", "all"] as const;
export const adminAnnouncementFilters = ["active", "draft", "expired", "hidden", "all"] as const;
export const adminAuditFilters = [
  "organization_applications",
  "organizations",
  "publications",
  "organization_members",
  "important_announcements",
  "all"
] as const;

export type AdminPublicationFilter = (typeof adminPublicationFilters)[number];
export type AdminOrganizationFilter = (typeof adminOrganizationFilters)[number];
export type AdminReportFilter = (typeof adminReportFilters)[number];
export type AdminAnnouncementFilter = (typeof adminAnnouncementFilters)[number];
export type AdminAuditFilter = (typeof adminAuditFilters)[number];

export type AdminPublicationListItem = Tables<"publications"> & {
  organizations: Pick<Tables<"organizations">, "id" | "name" | "slug" | "status"> | null;
};

export type AdminOrganizationListItem = Tables<"organizations"> & {
  organization_types: Pick<Tables<"organization_types">, "id" | "name" | "slug"> | null;
  pending_type: Pick<Tables<"organization_types">, "id" | "name" | "slug"> | null;
};

export type AdminReportListItem = Tables<"inaccuracy_reports"> & {
  publications: (Pick<Tables<"publications">, "id" | "slug" | "title" | "status"> & {
    organizations: Pick<Tables<"organizations">, "id" | "name" | "slug"> | null;
  }) | null;
};

export type AdminAnnouncementListItem = Tables<"important_announcements"> & {
  publications: Pick<Tables<"publications">, "id" | "slug" | "title" | "status"> | null;
};

export type AdminAuditListItem = Tables<"audit_events"> & {
  actor: Pick<Tables<"profiles">, "id" | "display_name"> | null;
};

export type PagedAdminResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export function parseAdminPage(value: unknown) {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseFilter<T extends readonly string[]>(value: unknown, filters: T, fallback: T[number]): T[number] {
  if (typeof value === "string" && filters.includes(value)) {
    return value as T[number];
  }

  return fallback;
}
