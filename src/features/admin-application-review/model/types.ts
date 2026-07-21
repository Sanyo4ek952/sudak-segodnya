import type { Tables } from "@/shared/api/supabase/database.types";

export const adminApplicationFilters = [
  "submitted",
  "needs_changes",
  "approved",
  "rejected",
  "all"
] as const;

export type AdminApplicationFilter = (typeof adminApplicationFilters)[number];

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialAdminActionState: AdminActionState = {
  status: "idle",
  message: ""
};

export type ApplicationWithRelations = Tables<"organization_applications"> & {
  organization_types: Pick<Tables<"organization_types">, "id" | "name" | "slug"> | null;
  organizations: Pick<Tables<"organizations">, "id" | "name" | "slug" | "status"> | null;
};

export type AdminApplicationListItem = ApplicationWithRelations & {
  applicant: Pick<Tables<"profiles">, "id" | "display_name" | "phone"> | null;
};

export type AdminApplicationsResult = {
  items: AdminApplicationListItem[];
  page: number;
  pageSize: number;
  total: number;
  filter: AdminApplicationFilter;
};

export function parseAdminApplicationFilter(value: unknown): AdminApplicationFilter {
  if (typeof value === "string" && adminApplicationFilters.includes(value as AdminApplicationFilter)) {
    return value as AdminApplicationFilter;
  }

  return "submitted";
}

export function parseAdminApplicationPage(value: unknown) {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
