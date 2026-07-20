"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type {
  AdminActionState,
  AdminApplicationListItem,
  AdminApplicationFilter,
  AdminApplicationsResult,
  ApplicationWithRelations
} from "@/features/admin-application-review/model/types";

const pageSize = 10;

const idSchema = z.string().uuid();
const commentSchema = z.string().trim().min(3).max(2000);

function actionError(message: string): AdminActionState {
  return { status: "error", message };
}

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function isCurrentUserAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return false;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  return profile?.role === "admin";
}

async function assertAdmin() {
  const isAdmin = await isCurrentUserAdmin();

  if (!isAdmin) {
    throw new Error("Access denied");
  }
}

async function attachApplicants(items: ApplicationWithRelations[]): Promise<AdminApplicationListItem[]> {
  if (items.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const applicantIds = Array.from(new Set(items.map((item) => item.applicant_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, phone")
    .in("id", applicantIds);

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return items.map((item) => ({
    ...item,
    applicant: profilesById.get(item.applicant_id) ?? null
  }));
}

export async function getAdminApplicationSummary() {
  await assertAdmin();

  const supabase = await createSupabaseServerClient();
  const [{ count: submittedCount }, { count: needsChangesCount }] = await Promise.all([
    supabase
      .from("organization_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("organization_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "needs_changes")
  ]);

  return {
    submitted: submittedCount ?? 0,
    needsChanges: needsChangesCount ?? 0
  };
}

export async function getAdminApplications({
  status,
  page
}: {
  status: AdminApplicationFilter;
  page: number;
}): Promise<AdminApplicationsResult> {
  await assertAdmin();

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("organization_applications")
    .select(
      "*, organization_categories(id, name, slug), organizations(id, name, slug, status)",
      { count: "exact" }
    )
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error("Failed to load applications");
  }

  return {
    items: await attachApplicants((data ?? []) as ApplicationWithRelations[]),
    page: safePage,
    pageSize,
    total: count ?? 0,
    filter: status
  };
}

export async function getAdminApplication(id: string) {
  await assertAdmin();

  const parsedId = idSchema.safeParse(id);

  if (!parsedId.success) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_applications")
    .select("*, organization_categories(id, name, slug), organizations(id, name, slug, status)")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const [application] = await attachApplicants([data as ApplicationWithRelations]);
  return application ?? null;
}

export async function approveApplicationAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsedId = idSchema.safeParse(getString(formData, "applicationId"));

  if (!parsedId.success) {
    return actionError("Заявка не найдена.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("approve_organization_application", {
    application_id: parsedId.data
  });

  if (error) {
    return actionError("Не получилось одобрить заявку. Возможно, статус уже изменился.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${parsedId.data}`);
  revalidatePath("/business");

  return {
    status: "success",
    message: "Заявка одобрена, организация и владелец созданы."
  };
}

export async function requestChangesApplicationAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsedId = idSchema.safeParse(getString(formData, "applicationId"));
  const parsedComment = commentSchema.safeParse(getString(formData, "adminComment"));

  if (!parsedId.success) {
    return actionError("Заявка не найдена.");
  }

  if (!parsedComment.success) {
    return actionError("Добавьте комментарий для заявителя.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("request_organization_application_changes", {
    application_id: parsedId.data,
    admin_comment: parsedComment.data
  });

  if (error) {
    return actionError("Не получилось запросить уточнение. Возможно, статус уже изменился.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${parsedId.data}`);
  revalidatePath("/business");

  return {
    status: "success",
    message: "Комментарий сохранен, заявка ожидает уточнения."
  };
}

export async function rejectApplicationAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsedId = idSchema.safeParse(getString(formData, "applicationId"));
  const parsedComment = commentSchema.safeParse(getString(formData, "adminComment"));

  if (!parsedId.success) {
    return actionError("Заявка не найдена.");
  }

  if (!parsedComment.success) {
    return actionError("Укажите причину отклонения.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reject_organization_application", {
    application_id: parsedId.data,
    admin_comment: parsedComment.data
  });

  if (error) {
    return actionError("Не получилось отклонить заявку. Возможно, статус уже изменился.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${parsedId.data}`);
  revalidatePath("/business");

  return {
    status: "success",
    message: "Заявка отклонена, организация не создана."
  };
}
