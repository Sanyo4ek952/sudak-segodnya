"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { Tables } from "@/shared/api/supabase/database.types";
import type {
  BusinessActionState,
  BusinessMenuCategory,
  BusinessMembership,
  BusinessOrganization,
  BusinessPublication
} from "@/features/business-cabinet/model/types";

const uuidSchema = z.string().uuid();
const publicationStatuses = ["draft", "scheduled", "moderation", "published", "cancelled", "completed"] as const;

const profileSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(2000),
  address: z.string().trim().min(3).max(300),
  phone: z.string().trim().min(5).max(80),
  workingHours: z.string().trim().max(500).optional()
});

const publicationSchema = z.object({
  organizationId: uuidSchema,
  publicationId: z.string().uuid().optional().or(z.literal("")),
  type: z.enum(["event", "announcement", "promo", "regular", "news"]),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(10).max(4000),
  categorySlug: z.string().trim().min(2).max(60),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  validUntil: z.string().optional(),
  place: z.string().trim().max(300).optional(),
  priceText: z.string().trim().max(120).optional(),
  isFree: z.boolean(),
  ageLimit: z.string().trim().max(40).optional(),
  contactPhone: z.string().trim().max(80).optional(),
  scheduleText: z.string().trim().max(1000).optional(),
  status: z.enum(publicationStatuses)
});

const menuCategorySchema = z.object({
  organizationId: uuidSchema,
  categoryId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean()
});

const menuItemSchema = z.object({
  organizationId: uuidSchema,
  categoryId: z.string().uuid().optional().or(z.literal("")),
  itemId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  priceText: z.string().trim().max(120).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  isAvailable: z.boolean()
});

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getBoolean(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function actionError(message: string): BusinessActionState {
  return { status: "error", message };
}

function actionSuccess(message: string): BusinessActionState {
  return { status: "success", message };
}

function toDateTime(value: string | undefined) {
  return value ? new Date(value).toISOString() : null;
}

function makeSlug(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${base || "publication"}-${crypto.randomUUID().slice(0, 8)}`;
}

async function getCurrentUserId() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function assertBusinessMembership(organizationId: string) {
  const parsedId = uuidSchema.safeParse(organizationId);

  if (!parsedId.success) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect("/login?next=/business");
  }

  const { data } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, is_active, created_at, updated_at, organizations(id, name, slug, status)")
    .eq("organization_id", parsedId.data)
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data?.organizations || data.organizations.status !== "active") {
    return null;
  }

  return data as BusinessMembership;
}

export async function getBusinessOrganizations() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return [];
  }

  const { data } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, is_active, created_at, updated_at, organizations(id, name, slug, status)")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return ((data ?? []) as BusinessMembership[]).filter(
    (membership) => membership.organizations?.status === "active"
  );
}

export async function getBusinessOrganization(organizationId: string) {
  const membership = await assertBusinessMembership(organizationId);

  if (!membership) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("*, organization_categories(id, name, slug)")
    .eq("id", organizationId)
    .maybeSingle();

  return data as BusinessOrganization | null;
}

export async function getBusinessOverview(organizationId: string) {
  const organization = await getBusinessOrganization(organizationId);

  if (!organization) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [{ count: activePublications }, { count: menuItems }, { data: upcomingPublications }] = await Promise.all([
    supabase
      .from("publications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["published", "scheduled"]),
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_available", true),
    supabase
      .from("publications")
      .select("id, title, status, starts_at, valid_until")
      .eq("organization_id", organizationId)
      .in("status", ["published", "scheduled"])
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(3)
  ]);

  return {
    organization,
    activePublications: activePublications ?? 0,
    menuItems: menuItems ?? 0,
    upcomingPublications: upcomingPublications ?? []
  };
}

export async function getBusinessPublications(organizationId: string) {
  const membership = await assertBusinessMembership(organizationId);

  if (!membership) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("publications")
    .select("*, publication_schedules(id, schedule_text, sort_order)")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  return (data ?? []) as BusinessPublication[];
}

export async function getBusinessPublication(organizationId: string, publicationId: string) {
  const membership = await assertBusinessMembership(organizationId);
  const parsedPublicationId = uuidSchema.safeParse(publicationId);

  if (!membership || !parsedPublicationId.success) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("publications")
    .select("*, publication_schedules(id, schedule_text, sort_order)")
    .eq("organization_id", organizationId)
    .eq("id", parsedPublicationId.data)
    .maybeSingle();

  return data as BusinessPublication | null;
}

export async function getBusinessMenu(organizationId: string) {
  const membership = await assertBusinessMembership(organizationId);

  if (!membership) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("menu_categories")
    .select("*, menu_items(*)")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  return (data ?? []) as BusinessMenuCategory[];
}

export async function getBusinessMembers(organizationId: string) {
  const membership = await assertBusinessMembership(organizationId);

  if (!membership) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_members")
    .select("id, user_id, role, is_active, created_at")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function updateOrganizationProfileAction(
  _state: BusinessActionState,
  formData: FormData
): Promise<BusinessActionState> {
  const parsed = profileSchema.safeParse({
    organizationId: getString(formData, "organizationId"),
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    address: getString(formData, "address"),
    phone: getString(formData, "phone"),
    workingHours: getString(formData, "workingHours")
  });

  if (!parsed.success) {
    return actionError("Проверьте данные профиля организации.");
  }

  const membership = await assertBusinessMembership(parsed.data.organizationId);

  if (!membership) {
    return actionError("Нет доступа к этой организации.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_member_organization_profile", {
    organization_id: parsed.data.organizationId,
    name: parsed.data.name,
    description: parsed.data.description,
    address: parsed.data.address,
    phone: parsed.data.phone,
    working_hours: parsed.data.workingHours ?? ""
  });

  if (error) {
    return actionError("Не получилось обновить профиль организации.");
  }

  revalidatePath(`/business/${parsed.data.organizationId}`);
  revalidatePath(`/business/${parsed.data.organizationId}/profile`);
  revalidatePath("/organizations");
  return actionSuccess("Профиль организации обновлен.");
}

export async function savePublicationAction(
  _state: BusinessActionState,
  formData: FormData
): Promise<BusinessActionState> {
  const parsed = publicationSchema.safeParse({
    organizationId: getString(formData, "organizationId"),
    publicationId: getString(formData, "publicationId"),
    type: getString(formData, "type"),
    title: getString(formData, "title"),
    description: getString(formData, "description"),
    categorySlug: getString(formData, "categorySlug"),
    startsAt: getString(formData, "startsAt"),
    endsAt: getString(formData, "endsAt"),
    validUntil: getString(formData, "validUntil"),
    place: getString(formData, "place"),
    priceText: getString(formData, "priceText"),
    isFree: getBoolean(formData, "isFree"),
    ageLimit: getString(formData, "ageLimit"),
    contactPhone: getString(formData, "contactPhone"),
    scheduleText: getString(formData, "scheduleText"),
    status: getString(formData, "status")
  });

  if (!parsed.success) {
    return actionError("Проверьте поля публикации.");
  }

  const membership = await assertBusinessMembership(parsed.data.organizationId);
  const userId = await getCurrentUserId();

  if (!membership || !userId) {
    return actionError("Нет доступа к этой организации.");
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId,
    author_id: userId,
    type: parsed.data.type,
    status: parsed.data.status,
    title: parsed.data.title,
    description: parsed.data.description,
    category_slug: parsed.data.categorySlug,
    starts_at: toDateTime(parsed.data.startsAt),
    ends_at: toDateTime(parsed.data.endsAt),
    valid_until: toDateTime(parsed.data.validUntil),
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    sort_published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    place: parsed.data.place || null,
    price_text: parsed.data.isFree ? "Бесплатно" : parsed.data.priceText || "Уточняйте",
    is_free: parsed.data.isFree,
    age_limit: parsed.data.ageLimit || null,
    contact_phone: parsed.data.contactPhone || null
  };

  let publication: Pick<Tables<"publications">, "id"> | null = null;
  let error;

  if (parsed.data.publicationId) {
    const { data: existing } = await supabase
      .from("publications")
      .select("id, status")
      .eq("id", parsed.data.publicationId)
      .eq("organization_id", parsed.data.organizationId)
      .maybeSingle();

    if (!existing || existing.status === "hidden" || existing.status === "blocked") {
      return actionError("Эту публикацию нельзя редактировать.");
    }

    const result = await supabase
      .from("publications")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    publication = result.data;
    error = result.error;
  } else {
    const result = await supabase
      .from("publications")
      .insert({
        ...payload,
        slug: makeSlug(parsed.data.title)
      })
      .select("id")
      .single();
    publication = result.data;
    error = result.error;
  }

  if (error || !publication) {
    return actionError("Не получилось сохранить публикацию.");
  }

  await supabase.from("publication_schedules").delete().eq("publication_id", publication.id);

  if (parsed.data.type === "regular" && parsed.data.scheduleText) {
    await supabase.from("publication_schedules").insert({
      publication_id: publication.id,
      schedule_text: parsed.data.scheduleText,
      sort_order: 0
    });
  }

  revalidatePath(`/business/${parsed.data.organizationId}`);
  revalidatePath(`/business/${parsed.data.organizationId}/publications`);
  revalidatePath("/");
  return actionSuccess("Публикация сохранена.");
}

export async function changePublicationStatusAction(formData: FormData) {
  const organizationId = getString(formData, "organizationId");
  const publicationId = getString(formData, "publicationId");
  const status = getString(formData, "status");
  const parsed = z.object({
    organizationId: uuidSchema,
    publicationId: uuidSchema,
    status: z.enum(["cancelled", "completed"])
  }).safeParse({ organizationId, publicationId, status });

  if (!parsed.success || !(await assertBusinessMembership(organizationId))) {
    return;
  }

  const payload = parsed.data.status === "cancelled"
    ? { status: parsed.data.status, cancelled_at: new Date().toISOString() }
    : { status: parsed.data.status, completed_at: new Date().toISOString() };

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("publications")
    .update(payload)
    .eq("id", parsed.data.publicationId)
    .eq("organization_id", parsed.data.organizationId);

  revalidatePath(`/business/${parsed.data.organizationId}/publications`);
  revalidatePath("/");
}

export async function deleteDraftPublicationAction(formData: FormData) {
  const organizationId = getString(formData, "organizationId");
  const publicationId = getString(formData, "publicationId");
  const parsed = z.object({ organizationId: uuidSchema, publicationId: uuidSchema }).safeParse({ organizationId, publicationId });

  if (!parsed.success || !(await assertBusinessMembership(organizationId))) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("publications")
    .delete()
    .eq("id", parsed.data.publicationId)
    .eq("organization_id", parsed.data.organizationId)
    .eq("status", "draft");

  revalidatePath(`/business/${parsed.data.organizationId}/publications`);
}

export async function saveMenuCategoryAction(
  _state: BusinessActionState,
  formData: FormData
): Promise<BusinessActionState> {
  const parsed = menuCategorySchema.safeParse({
    organizationId: getString(formData, "organizationId"),
    categoryId: getString(formData, "categoryId"),
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    sortOrder: getString(formData, "sortOrder") || "0",
    isActive: getBoolean(formData, "isActive")
  });

  if (!parsed.success || !(await assertBusinessMembership(getString(formData, "organizationId")))) {
    return actionError("Проверьте данные категории.");
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive
  };

  const { error } = parsed.data.categoryId
    ? await supabase
        .from("menu_categories")
        .update(payload)
        .eq("id", parsed.data.categoryId)
        .eq("organization_id", parsed.data.organizationId)
    : await supabase.from("menu_categories").insert(payload);

  if (error) {
    return actionError("Не получилось сохранить раздел меню.");
  }

  revalidatePath(`/business/${parsed.data.organizationId}/menu`);
  revalidatePath(`/organizations`);
  return actionSuccess("Раздел меню сохранен.");
}

export async function saveMenuItemAction(
  _state: BusinessActionState,
  formData: FormData
): Promise<BusinessActionState> {
  const parsed = menuItemSchema.safeParse({
    organizationId: getString(formData, "organizationId"),
    categoryId: getString(formData, "categoryId"),
    itemId: getString(formData, "itemId"),
    title: getString(formData, "title"),
    description: getString(formData, "description"),
    priceText: getString(formData, "priceText"),
    sortOrder: getString(formData, "sortOrder") || "0",
    isAvailable: getBoolean(formData, "isAvailable")
  });

  if (!parsed.success || !(await assertBusinessMembership(getString(formData, "organizationId")))) {
    return actionError("Проверьте данные позиции.");
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    organization_id: parsed.data.organizationId,
    category_id: parsed.data.categoryId || null,
    title: parsed.data.title,
    description: parsed.data.description || null,
    price_text: parsed.data.priceText || null,
    sort_order: parsed.data.sortOrder,
    is_available: parsed.data.isAvailable
  };

  const { error } = parsed.data.itemId
    ? await supabase
        .from("menu_items")
        .update(payload)
        .eq("id", parsed.data.itemId)
        .eq("organization_id", parsed.data.organizationId)
    : await supabase.from("menu_items").insert(payload);

  if (error) {
    return actionError("Не получилось сохранить позицию меню.");
  }

  revalidatePath(`/business/${parsed.data.organizationId}/menu`);
  revalidatePath(`/organizations`);
  return actionSuccess("Позиция меню сохранена.");
}

export async function deleteMenuItemAction(formData: FormData) {
  const parsed = z.object({
    organizationId: uuidSchema,
    itemId: uuidSchema
  }).safeParse({
    organizationId: getString(formData, "organizationId"),
    itemId: getString(formData, "itemId")
  });

  if (!parsed.success || !(await assertBusinessMembership(getString(formData, "organizationId")))) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("menu_items")
    .delete()
    .eq("id", parsed.data.itemId)
    .eq("organization_id", parsed.data.organizationId);

  revalidatePath(`/business/${parsed.data.organizationId}/menu`);
  revalidatePath("/organizations");
}

export async function deleteEmptyMenuCategoryAction(formData: FormData) {
  const parsed = z.object({
    organizationId: uuidSchema,
    categoryId: uuidSchema
  }).safeParse({
    organizationId: getString(formData, "organizationId"),
    categoryId: getString(formData, "categoryId")
  });

  if (!parsed.success || !(await assertBusinessMembership(getString(formData, "organizationId")))) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", parsed.data.organizationId)
    .eq("category_id", parsed.data.categoryId);

  if (count) {
    return;
  }

  await supabase
    .from("menu_categories")
    .delete()
    .eq("id", parsed.data.categoryId)
    .eq("organization_id", parsed.data.organizationId);

  revalidatePath(`/business/${parsed.data.organizationId}/menu`);
  revalidatePath("/organizations");
}
