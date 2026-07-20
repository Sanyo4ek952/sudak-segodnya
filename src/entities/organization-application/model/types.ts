import type { Tables } from "@/shared/api/supabase/database.types";

export type OrganizationApplication = Tables<"organization_applications">;
export type OrganizationCategory = Tables<"organization_categories">;
export type OrganizationMembership = Tables<"organization_members"> & {
  organizations: Pick<Tables<"organizations">, "id" | "name" | "slug" | "status"> | null;
};

export const organizationApplicationStatusLabels: Record<OrganizationApplication["status"], string> = {
  draft: "Черновик",
  submitted: "На рассмотрении",
  needs_changes: "Нужно уточнение",
  approved: "Одобрена",
  rejected: "Отклонена"
};

export const editableApplicationStatuses: OrganizationApplication["status"][] = ["draft", "needs_changes"];
