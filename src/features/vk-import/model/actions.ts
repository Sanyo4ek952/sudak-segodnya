"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { invokeVkImport } from "@/features/vk-import/server/sync";
import {
  type VkExternalItemStatus,
  type VkImportActionState
} from "@/features/vk-import/model/types";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

const optionalUuidSchema = postgresUuidSchema.or(z.literal(""));
const sourceInputSchema = z.object({
  name: z.string().trim().min(2).max(180),
  domain: z.string().trim().min(2).max(200),
  organizationId: optionalUuidSchema,
  isActive: z.boolean()
});

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function actionError(message: string, fieldErrors?: Record<string, string>): VkImportActionState {
  return { status: "error", message, ...(fieldErrors ? { fieldErrors } : {}) };
}

function actionSuccess(message: string): VkImportActionState {
  return { status: "success", message };
}

function normalizeVkDomain(rawValue: string) {
  let value = rawValue.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!["vk.com", "www.vk.com"].includes(url.hostname.toLowerCase())) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 1 || url.search || url.hash) return null;
      value = parts[0];
    } catch {
      return null;
    }
  }
  value = value.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_.-]{2,100}$/.test(value) ? value : null;
}

async function getAdminContext() {
  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: isAdmin }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("is_admin")
  ]);
  if (!userData.user || !isAdmin) throw new Error("Administrator access required");
  return { supabase, user: userData.user };
}

export async function getVkSourceAdminData() {
  const { supabase } = await getAdminContext();
  const [sources, organizations] = await Promise.all([
    supabase
      .from("external_sources")
      .select("*, organizations(id, name)")
      .eq("platform", "vk")
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("status", "active")
      .order("name")
  ]);
  if (sources.error || organizations.error) throw new Error("Failed to load VK sources");
  return { sources: sources.data ?? [], organizations: organizations.data ?? [] };
}

export async function getVkExternalItems({
  status,
  page
}: {
  status: VkExternalItemStatus;
  page: number;
}) {
  const { supabase } = await getAdminContext();
  const pageSize = 20;
  const safePage = Math.max(1, Math.trunc(page));
  const from = (safePage - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("external_items")
    .select("*, external_sources(id, name, domain, organization_id)", { count: "exact" })
    .eq("status", status)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error("Failed to load VK import queue");
  return { items: data ?? [], total: count ?? 0, page: safePage, pageSize };
}

export async function createVkSourceAction(
  _state: VkImportActionState,
  formData: FormData
): Promise<VkImportActionState> {
  const parsed = sourceInputSchema.safeParse({
    name: getString(formData, "name"),
    domain: getString(formData, "domain"),
    organizationId: getString(formData, "organizationId"),
    isActive: formData.get("isActive") === "on"
  });
  if (!parsed.success) return actionError("Проверьте данные источника.");
  const domain = normalizeVkDomain(parsed.data.domain);
  if (!domain) {
    return actionError("Укажите domain или ссылку на сообщество VK.", {
      domain: "Например: sudak_today или https://vk.com/sudak_today"
    });
  }

  const { supabase, user } = await getAdminContext();
  const organizationId = parsed.data.organizationId || null;
  if (organizationId) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (!organization) return actionError("Выбранная организация недоступна.");
  }

  const { error } = await supabase.from("external_sources").insert({
    platform: "vk",
    domain,
    name: parsed.data.name,
    url: `https://vk.com/${domain}`,
    organization_id: organizationId,
    is_active: parsed.data.isActive,
    created_by: user.id
  });
  if (error?.code === "23505") return actionError("Такое VK-сообщество уже добавлено.");
  if (error) return actionError("Не удалось добавить VK-источник.");

  revalidatePath("/admin/vk");
  revalidatePath("/admin/vk/sources");
  return actionSuccess("VK-источник добавлен.");
}

export async function updateVkSourceAction(
  _state: VkImportActionState,
  formData: FormData
): Promise<VkImportActionState> {
  const identifiers = z.object({
    sourceId: postgresUuidSchema,
    intent: z.enum(["save", "toggle"])
  }).safeParse({
    sourceId: getString(formData, "sourceId"),
    intent: getString(formData, "intent")
  });
  if (!identifiers.success) return actionError("VK-источник не найден.");
  const { supabase } = await getAdminContext();
  const { data: source } = await supabase
    .from("external_sources")
    .select("id, is_active")
    .eq("id", identifiers.data.sourceId)
    .eq("platform", "vk")
    .maybeSingle();
  if (!source) return actionError("VK-источник не найден.");

  if (identifiers.data.intent === "toggle") {
    const { error } = await supabase
      .from("external_sources")
      .update({ is_active: !source.is_active })
      .eq("id", source.id);
    if (error) return actionError("Не удалось изменить состояние источника.");
    revalidatePath("/admin/vk/sources");
    return actionSuccess(source.is_active ? "Импорт приостановлен." : "Импорт включён.");
  }

  const settings = z.object({
    name: z.string().trim().min(2).max(180),
    organizationId: optionalUuidSchema
  }).safeParse({
    name: getString(formData, "name"),
    organizationId: getString(formData, "organizationId")
  });
  if (!settings.success) return actionError("Проверьте настройки источника.");
  const organizationId = settings.data.organizationId || null;
  if (organizationId) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (!organization) return actionError("Выбранная организация недоступна.");
  }

  const { error } = await supabase
    .from("external_sources")
    .update({ name: settings.data.name, organization_id: organizationId })
    .eq("id", source.id);
  if (error) return actionError("Не удалось сохранить настройки источника.");
  revalidatePath("/admin/vk");
  revalidatePath("/admin/vk/sources");
  return actionSuccess("Настройки источника сохранены.");
}

export async function runVkImportNowAction(
  _state: VkImportActionState,
  _formData: FormData
): Promise<VkImportActionState> {
  void _state;
  void _formData;
  await getAdminContext();
  try {
    const result = await invokeVkImport();
    revalidatePath("/admin/vk");
    revalidatePath("/admin/vk/sources");
    const message = `Синхронизация завершена: новых материалов — ${result.insertedCount}, ошибок источников — ${result.failedCount}.`;
    return result.failedCount > 0 ? actionError(message) : actionSuccess(message);
  } catch {
    return actionError("Не удалось запустить VK-импорт. Проверьте Edge Function и server secrets.");
  }
}

export async function ignoreVkExternalItemAction(formData: FormData) {
  const itemId = postgresUuidSchema.safeParse(getString(formData, "itemId"));
  if (!itemId.success) return;
  const { supabase } = await getAdminContext();
  const { error } = await supabase.rpc("ignore_vk_external_item", { p_item_id: itemId.data });
  if (error) throw new Error("Failed to ignore VK item");
  revalidatePath("/admin/vk");
}

export async function prepareVkExternalItemAction(formData: FormData) {
  const itemId = postgresUuidSchema.safeParse(getString(formData, "itemId"));
  if (!itemId.success) redirect("/admin/vk?error=prepare");
  const { supabase } = await getAdminContext();
  const { data: candidateId, error } = await supabase.rpc("prepare_vk_external_item_for_review", {
    p_item_id: itemId.data
  });
  if (error || !candidateId) redirect("/admin/vk?error=prepare");
  redirect(`/admin/imports/${candidateId}`);
}
