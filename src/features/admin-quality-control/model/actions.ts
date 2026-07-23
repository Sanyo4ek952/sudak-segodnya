"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isCurrentUserAdmin } from "@/features/admin-application-review/model/actions";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { TablesInsert, TablesUpdate } from "@/shared/api/supabase/database.types";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";
import type {
  AdminActionState,
  AdminAuditFilter,
  AdminAuditListItem,
  AdminAnnouncementFilter,
  AdminAnnouncementListItem,
  AdminOrganizationFilter,
  AdminOrganizationListItem,
  AdminPublicationFilter,
  AdminPublicationListItem,
  AdminReportFilter,
  AdminReportListItem,
  PagedAdminResult
} from "@/features/admin-quality-control/model/types";

const pageSize = 10;
const uuidSchema = postgresUuidSchema;
const commentSchema = z.string().trim().max(1000).optional();

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function actionError(message: string): AdminActionState {
  return { status: "error", message };
}

function actionSuccess(message: string): AdminActionState {
  return { status: "success", message };
}

async function assertAdmin() {
  if (!(await isCurrentUserAdmin())) {
    throw new Error("Access denied");
  }
}

async function getCurrentAdminId() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function rangeForPage(page: number) {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  return { safePage, from, to: from + pageSize - 1 };
}

export async function getAdminQualitySummary() {
  await assertAdmin();
  const supabase = await createSupabaseServerClient();
  const [
    { count: hiddenPublications },
    { count: blockedPublications },
    { count: blockedOrganizations },
    { count: newReports },
    { count: activeAnnouncements }
  ] = await Promise.all([
    supabase.from("publications").select("id", { count: "exact", head: true }).eq("status", "hidden"),
    supabase.from("publications").select("id", { count: "exact", head: true }).eq("status", "blocked"),
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("status", "blocked"),
    supabase.from("inaccuracy_reports").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("important_announcements").select("id", { count: "exact", head: true }).eq("status", "active")
  ]);

  return {
    hiddenPublications: hiddenPublications ?? 0,
    blockedPublications: blockedPublications ?? 0,
    blockedOrganizations: blockedOrganizations ?? 0,
    newReports: newReports ?? 0,
    activeAnnouncements: activeAnnouncements ?? 0
  };
}

export async function getAdminAnalyticsSummary() {
  await assertAdmin();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const supabase = await createSupabaseServerClient();
  const [
    { count: totalEvents },
    { count: organizationViews },
    { count: publicationViews },
    { count: phoneClicks },
    { count: routeClicks }
  ] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since.toISOString()),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "organization_view")
      .gte("created_at", since.toISOString()),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "publication_view")
      .gte("created_at", since.toISOString()),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "phone_click")
      .gte("created_at", since.toISOString()),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "route_click")
      .gte("created_at", since.toISOString())
  ]);

  return {
    totalEvents: totalEvents ?? 0,
    organizationViews: organizationViews ?? 0,
    publicationViews: publicationViews ?? 0,
    phoneClicks: phoneClicks ?? 0,
    routeClicks: routeClicks ?? 0
  };
}

export async function getAdminPublications({
  status,
  page
}: {
  status: AdminPublicationFilter;
  page: number;
}): Promise<PagedAdminResult<AdminPublicationListItem>> {
  await assertAdmin();
  const { safePage, from, to } = rangeForPage(page);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("publications")
    .select("*, organizations(id, name, slug, status)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error("Failed to load publications");
  }

  return { items: (data ?? []) as AdminPublicationListItem[], page: safePage, pageSize, total: count ?? 0 };
}

export async function getAdminOrganizations({
  status,
  page
}: {
  status: AdminOrganizationFilter;
  page: number;
}): Promise<PagedAdminResult<AdminOrganizationListItem>> {
  await assertAdmin();
  const { safePage, from, to } = rangeForPage(page);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("organizations")
    .select(`
      *,
      organization_types!organizations_category_id_fkey(id, name, slug),
      pending_type:organization_types!organizations_pending_type_id_fkey(id, name, slug)
    `, { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error("Failed to load organizations");
  }

  return { items: (data ?? []) as AdminOrganizationListItem[], page: safePage, pageSize, total: count ?? 0 };
}

export async function getAdminReports({
  status,
  page
}: {
  status: AdminReportFilter;
  page: number;
}): Promise<PagedAdminResult<AdminReportListItem>> {
  await assertAdmin();
  const { safePage, from, to } = rangeForPage(page);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("inaccuracy_reports")
    .select("*, publications(id, slug, title, status, organizations(id, name, slug))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error("Failed to load reports");
  }

  return { items: (data ?? []) as AdminReportListItem[], page: safePage, pageSize, total: count ?? 0 };
}

export async function getAdminAnnouncements({
  status,
  page
}: {
  status: AdminAnnouncementFilter;
  page: number;
}): Promise<PagedAdminResult<AdminAnnouncementListItem>> {
  await assertAdmin();
  const { safePage, from, to } = rangeForPage(page);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("important_announcements")
    .select("*, publications(id, slug, title, status)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error("Failed to load announcements");
  }

  return { items: (data ?? []) as AdminAnnouncementListItem[], page: safePage, pageSize, total: count ?? 0 };
}

export async function getAdminAnnouncement(id: string) {
  await assertAdmin();
  const parsedId = uuidSchema.safeParse(id);

  if (!parsedId.success) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("important_announcements")
    .select("*, publications(id, slug, title, status)")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as AdminAnnouncementListItem;
}

export async function getAdminAuditEvents({
  entityType,
  page
}: {
  entityType: AdminAuditFilter;
  page: number;
}): Promise<PagedAdminResult<AdminAuditListItem>> {
  await assertAdmin();
  const { safePage, from, to } = rangeForPage(page);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (entityType !== "all") {
    query = query.eq("entity_type", entityType);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error("Failed to load audit history");
  }

  const actorIds = Array.from(
    new Set((data ?? []).flatMap((event) => event.actor_id ? [event.actor_id] : []))
  );
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", actorIds)
    : { data: [] };
  const actorById = new Map((actors ?? []).map((actor) => [actor.id, actor]));

  return {
    items: (data ?? []).map((event) => ({
      ...event,
      actor: event.actor_id ? actorById.get(event.actor_id) ?? null : null
    })),
    page: safePage,
    pageSize,
    total: count ?? 0
  };
}

export async function changeAdminPublicationStatusAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await assertAdmin();
  const parsed = z.object({
    publicationId: uuidSchema,
    status: z.enum(["published", "hidden", "blocked"]),
    comment: commentSchema
  }).safeParse({
    publicationId: getString(formData, "publicationId"),
    status: getString(formData, "status"),
    comment: getString(formData, "comment")
  });

  if (!parsed.success) {
    return actionError("Проверьте статус и причину действия.");
  }

  if (!parsed.data.comment) {
    return actionError("Укажите причину административного действия.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_moderate_publication", {
    p_publication_id: parsed.data.publicationId,
    p_status: parsed.data.status,
    p_reason: parsed.data.comment ?? ""
  });

  if (error) {
    return actionError(
      error.message.includes("reason")
        ? "Для скрытия или блокировки укажите причину."
        : "Не удалось изменить статус публикации."
    );
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/publications");
  return actionSuccess(
    parsed.data.status === "published"
      ? "Публикация восстановлена."
      : "Статус публикации обновлён, причина записана в историю."
  );
}

export async function changeAdminOrganizationStatusAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await assertAdmin();
  const parsed = z.object({
    organizationId: uuidSchema,
    status: z.enum(["active", "blocked"]),
    comment: commentSchema
  }).safeParse({
    organizationId: getString(formData, "organizationId"),
    status: getString(formData, "status"),
    comment: getString(formData, "comment")
  });

  if (!parsed.success) {
    return actionError("Проверьте статус и причину действия.");
  }

  if (!parsed.data.comment) {
    return actionError("Укажите причину административного действия.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_moderate_organization", {
    p_organization_id: parsed.data.organizationId,
    p_status: parsed.data.status,
    p_reason: parsed.data.comment ?? ""
  });

  if (error) {
    return actionError(
      error.message.includes("reason")
        ? "Для блокировки укажите причину."
        : "Не удалось изменить статус организации."
    );
  }

  revalidatePath("/");
  revalidatePath("/organizations");
  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  return actionSuccess(
    parsed.data.status === "active"
      ? "Организация восстановлена."
      : "Организация заблокирована, причина записана в историю."
  );
}

export async function reviewOrganizationTypeChangeAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await assertAdmin();
  const parsed = z.object({
    organizationId: uuidSchema,
    approve: z.enum(["true", "false"]),
    reason: z.string().trim().min(3).max(1000)
  }).safeParse({
    organizationId: getString(formData, "organizationId"),
    approve: getString(formData, "approve"),
    reason: getString(formData, "reason")
  });

  if (!parsed.success) {
    return actionError("Укажите решение и комментарий длиной не менее трёх символов.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_organization_type_change", {
    p_organization_id: parsed.data.organizationId,
    p_approve: parsed.data.approve === "true",
    p_reason: parsed.data.reason
  });

  if (error) {
    return actionError("Не удалось обработать изменение типа организации.");
  }

  revalidatePath("/organizations");
  revalidatePath("/admin/organizations");
  return actionSuccess(
    parsed.data.approve === "true"
      ? "Новый тип организации подтверждён."
      : "Изменение типа отклонено."
  );
}

export async function changeAdminReportStatusAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await assertAdmin();
  const parsed = z.object({
    reportId: uuidSchema,
    status: z.enum(["reviewing", "resolved", "rejected"]),
    adminComment: z.string().trim().max(1000).optional()
  }).safeParse({
    reportId: getString(formData, "reportId"),
    status: getString(formData, "status"),
    adminComment: getString(formData, "adminComment")
  });

  if (!parsed.success) {
    return actionError("Проверьте данные обработки.");
  }

  const adminId = await getCurrentAdminId();

  if (!adminId) {
    return actionError("Администратор не найден.");
  }

  const isFinal = parsed.data.status === "resolved" || parsed.data.status === "rejected";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("inaccuracy_reports")
    .update({
      status: parsed.data.status,
      admin_comment: parsed.data.adminComment || null,
      resolved_by: isFinal ? adminId : null,
      resolved_at: isFinal ? new Date().toISOString() : null
    })
    .eq("id", parsed.data.reportId);

  if (error) {
    return actionError("Не удалось обработать сообщение.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  return actionSuccess("Статус сообщения обновлён.");
}

export async function saveImportantAnnouncementAction(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await assertAdmin();
  const parsed = z.object({
    announcementId: uuidSchema.optional().or(z.literal("")),
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().min(5).max(1000),
    status: z.enum(["draft", "active", "expired", "hidden"]),
    activeFrom: z.string().optional(),
    activeUntil: z.string().optional(),
    publicationSlug: z.string().trim().max(160).optional()
  }).safeParse({
    announcementId: getString(formData, "announcementId"),
    title: getString(formData, "title"),
    description: getString(formData, "description"),
    status: getString(formData, "status"),
    activeFrom: getString(formData, "activeFrom"),
    activeUntil: getString(formData, "activeUntil"),
    publicationSlug: getString(formData, "publicationSlug")
  });

  if (!parsed.success) {
    return actionError("Проверьте поля важного объявления.");
  }

  if (parsed.data.status === "active" && (!parsed.data.activeFrom || !parsed.data.activeUntil)) {
    return actionError("Для активного объявления нужен период показа.");
  }

  const supabase = await createSupabaseServerClient();
  const adminId = await getCurrentAdminId();

  if (!adminId) {
    return actionError("Администратор не найден.");
  }

  let publicationId: string | null = null;

  if (parsed.data.publicationSlug) {
    const { data: publication } = await supabase
      .from("publications")
      .select("id")
      .eq("slug", parsed.data.publicationSlug)
      .maybeSingle();

    if (!publication) {
      return actionError("Связанная публикация не найдена.");
    }

    publicationId = publication.id;
  }

  const payload = {
    title: parsed.data.title,
    description: parsed.data.description,
    status: parsed.data.status,
    publication_id: publicationId,
    active_from: parsed.data.activeFrom ? new Date(parsed.data.activeFrom).toISOString() : null,
    active_until: parsed.data.activeUntil ? new Date(parsed.data.activeUntil).toISOString() : null
  } satisfies TablesUpdate<"important_announcements">;

  const { error } = parsed.data.announcementId
    ? await supabase.from("important_announcements").update(payload).eq("id", parsed.data.announcementId)
    : await supabase.from("important_announcements").insert({
        ...payload,
        created_by: adminId
      } satisfies TablesInsert<"important_announcements">);

  if (error) {
    return actionError("Не удалось сохранить важное объявление.");
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/important-announcements");
  return actionSuccess("Важное объявление сохранено.");
}

export async function changeImportantAnnouncementStatusAction(formData: FormData) {
  await assertAdmin();
  const parsed = z.object({
    announcementId: uuidSchema,
    status: z.enum(["active", "expired", "hidden"])
  }).safeParse({
    announcementId: getString(formData, "announcementId"),
    status: getString(formData, "status")
  });

  if (!parsed.success) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("important_announcements")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.announcementId);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/important-announcements");
}
