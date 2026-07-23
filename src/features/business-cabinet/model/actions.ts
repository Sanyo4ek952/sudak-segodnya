"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { Json, TablesInsert, TablesUpdate } from "@/shared/api/supabase/database.types";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";
import {
  createPublicationInputSchema,
  getFirstPublicationValidationError,
  type PublicationScheduleEntryInput
} from "@/entities/publication/model/publication-contract";
import type {
  BusinessActionState,
  BusinessMenuCategory,
  BusinessMembership,
  BusinessOrganization,
  BusinessPublication,
  OrganizationInvitation,
  OrganizationRepresentative
} from "@/features/business-cabinet/model/types";

const uuidSchema = postgresUuidSchema;

const profileSchema = z.object({
  organizationId: uuidSchema,
  typeId: uuidSchema,
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(2000),
  address: z.string().trim().min(3).max(300),
  phone: z.string().trim().min(5).max(80),
  workingHours: z.string().trim().max(500).optional(),
  latitude: z.union([z.literal(""), z.coerce.number().min(-90).max(90)]),
  longitude: z.union([z.literal(""), z.coerce.number().min(-180).max(180)]),
  website: z.union([z.literal(""), z.string().trim().url().max(500)]),
  telegram: z.union([z.literal(""), z.string().trim().url().max(500)]),
  vk: z.union([z.literal(""), z.string().trim().url().max(500)])
});

const menuCategorySchema = z.object({
  organizationId: uuidSchema,
  categoryId: uuidSchema.optional().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean()
});

const menuItemSchema = z.object({
  organizationId: uuidSchema,
  categoryId: uuidSchema.optional().or(z.literal("")),
  itemId: uuidSchema.optional().or(z.literal("")),
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

function toOptionalText(value: string | undefined) {
  return value ? value : null;
}

function toMoscowIsoOrOriginal(value: string) {
  if (!value) {
    return "";
  }

  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00+03:00`
    : value;
  const timestamp = Date.parse(normalized);

  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
}

function parseScheduleEntries(formData: FormData): PublicationScheduleEntryInput[] | null {
  const rawEntries = getString(formData, "scheduleEntries");

  if (rawEntries) {
    try {
      const value: unknown = JSON.parse(rawEntries);
      return Array.isArray(value) ? (value as PublicationScheduleEntryInput[]) : null;
    } catch {
      return null;
    }
  }

  const scheduleText = getString(formData, "scheduleText").trim();
  return scheduleText
    ? [{
        scheduleText,
        weekday: null,
        startsAt: null,
        endsAt: null,
        sortOrder: 0,
        timezone: "Europe/Moscow"
      }]
    : [];
}

function getPublicationRpcError(message: string) {
  const knownErrors: Array<[string, string]> = [
    ["Authentication required", "Войдите в аккаунт организации и повторите действие."],
    ["Active organization membership required", "Нет активного доступа к этой организации."],
    ["Publication does not belong", "Публикация не принадлежит выбранной организации."],
    ["Publication cannot be edited", "Эту публикацию нельзя редактировать в текущем статусе."],
    ["Active publication category not found", "Выбранная категория ленты недоступна."],
    ["Regular activity schedule is required", "Для регулярного занятия заполните расписание."],
    ["validity date", "Укажите будущий срок актуальности."],
    ["Event start", "Для мероприятия укажите корректные начало и окончание."],
    ["Scheduled publication time", "Укажите будущее время публикации."]
  ];

  return knownErrors.find(([fragment]) => message.includes(fragment))?.[1]
    ?? "Не получилось сохранить публикацию. Проверьте данные и повторите попытку.";
}

const publicationImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);
const maximumPublicationImageSize = 5 * 1024 * 1024;

function getPublicationImage(formData: FormData) {
  const value = formData.get("image");
  return value instanceof File && value.size > 0 ? value : null;
}

function validatePublicationImage(file: File | null) {
  if (!file) {
    return "Выберите изображение.";
  }

  if (!publicationImageTypes.has(file.type)) {
    return "Поддерживаются изображения JPG, PNG и WebP.";
  }

  if (file.size > maximumPublicationImageSize) {
    return "Размер изображения не должен превышать 5 МБ.";
  }

  return null;
}

async function replacePublicationImage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  publicationId: string,
  file: File
) {
  const extension = publicationImageTypes.get(file.type);

  if (!extension) {
    return { error: "Неподдерживаемый формат изображения.", imageUrl: undefined };
  }

  const { data: previousAsset } = await supabase
    .from("media_assets")
    .select("id, bucket_id, storage_path")
    .eq("publication_id", publicationId)
    .eq("purpose", "publication_photo")
    .is("deleted_at", null)
    .maybeSingle();

  const storagePath = `publications/${publicationId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("publication-images")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    return { error: "Не получилось загрузить изображение.", imageUrl: undefined };
  }

  if (previousAsset) {
    const { error: deactivateError } = await supabase
      .from("media_assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", previousAsset.id);

    if (deactivateError) {
      await supabase.storage.from("publication-images").remove([storagePath]);
      return { error: "Не получилось заменить текущее изображение.", imageUrl: undefined };
    }
  }

  const { error: assetError } = await supabase.from("media_assets").insert({
    bucket_id: "publication-images",
    storage_path: storagePath,
    purpose: "publication_photo",
    visibility: "public",
    publication_id: publicationId,
    alt_text: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    sort_order: 0
  });

  if (assetError) {
    if (previousAsset) {
      await supabase
        .from("media_assets")
        .update({ deleted_at: null })
        .eq("id", previousAsset.id);
    }
    await supabase.storage.from("publication-images").remove([storagePath]);
    return { error: "Не получилось связать изображение с публикацией.", imageUrl: undefined };
  }

  if (previousAsset) {
    await supabase.storage.from(previousAsset.bucket_id).remove([previousAsset.storage_path]);
  }

  const { data: signedImage } = await supabase.storage
    .from("publication-images")
    .createSignedUrl(storagePath, 60 * 10);

  return { error: null, imageUrl: signedImage?.signedUrl };
}

async function removePublicationImage(
  organizationId: string,
  publicationId: string
): Promise<BusinessActionState> {
  if (!(await assertBusinessMembership(organizationId))) {
    return actionError("Нет доступа к этой организации.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: publication } = await supabase
    .from("publications")
    .select("id")
    .eq("id", publicationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!publication) {
    return actionError("Публикация не найдена.");
  }

  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, bucket_id, storage_path")
    .eq("publication_id", publicationId)
    .eq("purpose", "publication_photo")
    .is("deleted_at", null)
    .maybeSingle();

  if (!asset) {
    return { ...actionSuccess("У публикации нет изображения."), imageRemoved: true };
  }

  const { error } = await supabase
    .from("media_assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", asset.id);

  if (error) {
    return actionError("Не получилось удалить изображение.");
  }

  await supabase.storage.from(asset.bucket_id).remove([asset.storage_path]);
  revalidatePath(`/business/${organizationId}/publications/${publicationId}`);
  revalidatePath("/");
  return { ...actionSuccess("Изображение удалено."), imageRemoved: true };
}

type OrganizationImagePurpose = "organization_logo" | "organization_cover";

async function replaceOrganizationImage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  purpose: OrganizationImagePurpose,
  file: File
) {
  const extension = publicationImageTypes.get(file.type);

  if (!extension) {
    return { error: "Неподдерживаемый формат изображения.", imageUrl: undefined };
  }

  const { data: previousAsset } = await supabase
    .from("media_assets")
    .select("id, bucket_id, storage_path")
    .eq("organization_id", organizationId)
    .eq("purpose", purpose)
    .is("deleted_at", null)
    .maybeSingle();
  const storagePath = `organizations/${organizationId}/${purpose}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("organization-images")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    return { error: "Не получилось загрузить изображение.", imageUrl: undefined };
  }

  if (previousAsset) {
    const { error: deactivateError } = await supabase
      .from("media_assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", previousAsset.id);

    if (deactivateError) {
      await supabase.storage.from("organization-images").remove([storagePath]);
      return { error: "Не получилось заменить текущее изображение.", imageUrl: undefined };
    }
  }

  const { error: assetError } = await supabase.from("media_assets").insert({
    bucket_id: "organization-images",
    storage_path: storagePath,
    purpose,
    visibility: "public",
    organization_id: organizationId,
    alt_text: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    sort_order: 0
  });

  if (assetError) {
    if (previousAsset) {
      await supabase.from("media_assets").update({ deleted_at: null }).eq("id", previousAsset.id);
    }
    await supabase.storage.from("organization-images").remove([storagePath]);
    return { error: "Не получилось связать изображение с организацией.", imageUrl: undefined };
  }

  if (previousAsset) {
    await supabase.storage.from(previousAsset.bucket_id).remove([previousAsset.storage_path]);
  }

  const { data: signedImage } = await supabase.storage
    .from("organization-images")
    .createSignedUrl(storagePath, 60 * 10);

  return { error: null, imageUrl: signedImage?.signedUrl };
}

async function removeOrganizationImage(
  organizationId: string,
  purpose: OrganizationImagePurpose
): Promise<BusinessActionState> {
  if (!(await assertBusinessMembership(organizationId))) {
    return actionError("Нет доступа к этой организации.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, bucket_id, storage_path")
    .eq("organization_id", organizationId)
    .eq("purpose", purpose)
    .is("deleted_at", null)
    .maybeSingle();

  if (!asset) {
    return {
      ...actionSuccess("Изображение уже отсутствует."),
      ...(purpose === "organization_logo" ? { logoRemoved: true } : { coverRemoved: true })
    };
  }

  const { error } = await supabase
    .from("media_assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", asset.id);

  if (error) {
    return actionError("Не получилось удалить изображение.");
  }

  await supabase.storage.from(asset.bucket_id).remove([asset.storage_path]);
  revalidatePath(`/business/${organizationId}/profile`);
  revalidatePath("/organizations");
  return {
    ...actionSuccess("Изображение удалено."),
    ...(purpose === "organization_logo" ? { logoRemoved: true } : { coverRemoved: true })
  };
}

async function replaceMenuItemImage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  itemId: string,
  file: File
) {
  const extension = publicationImageTypes.get(file.type);

  if (!extension) {
    return { error: "Неподдерживаемый формат изображения.", imageUrl: undefined };
  }

  const { data: previousAsset } = await supabase
    .from("media_assets")
    .select("id, bucket_id, storage_path")
    .eq("menu_item_id", itemId)
    .eq("purpose", "menu_item_photo")
    .is("deleted_at", null)
    .maybeSingle();
  const storagePath = `menu-items/${itemId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("menu-images")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    return { error: "Не получилось загрузить изображение позиции.", imageUrl: undefined };
  }

  if (previousAsset) {
    const { error: deactivateError } = await supabase
      .from("media_assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", previousAsset.id);

    if (deactivateError) {
      await supabase.storage.from("menu-images").remove([storagePath]);
      return { error: "Не получилось заменить текущее изображение.", imageUrl: undefined };
    }
  }

  const { error: assetError } = await supabase.from("media_assets").insert({
    bucket_id: "menu-images",
    storage_path: storagePath,
    purpose: "menu_item_photo",
    visibility: "public",
    menu_item_id: itemId,
    alt_text: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    sort_order: 0
  });

  if (assetError) {
    if (previousAsset) {
      await supabase.from("media_assets").update({ deleted_at: null }).eq("id", previousAsset.id);
    }
    await supabase.storage.from("menu-images").remove([storagePath]);
    return { error: "Не получилось связать изображение с позицией.", imageUrl: undefined };
  }

  if (previousAsset) {
    await supabase.storage.from(previousAsset.bucket_id).remove([previousAsset.storage_path]);
  }

  const { data: signedImage } = await supabase.storage
    .from("menu-images")
    .createSignedUrl(storagePath, 60 * 10);

  return { error: null, imageUrl: signedImage?.signedUrl };
}

async function removeMenuItemImage(
  organizationId: string,
  itemId: string
): Promise<BusinessActionState> {
  if (!(await assertBusinessMembership(organizationId))) {
    return actionError("Нет доступа к этой организации.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase
    .from("menu_items")
    .select("id")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!item) {
    return actionError("Позиция меню не найдена.");
  }

  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, bucket_id, storage_path")
    .eq("menu_item_id", itemId)
    .eq("purpose", "menu_item_photo")
    .is("deleted_at", null)
    .maybeSingle();

  if (!asset) {
    return { ...actionSuccess("Изображение уже отсутствует."), imageRemoved: true };
  }

  const { error } = await supabase
    .from("media_assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", asset.id);

  if (error) {
    return actionError("Не получилось удалить изображение.");
  }

  await supabase.storage.from(asset.bucket_id).remove([asset.storage_path]);
  revalidatePath(`/business/${organizationId}/menu`);
  revalidatePath("/organizations");
  return { ...actionSuccess("Изображение удалено."), imageRemoved: true };
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
    .select(`
      *,
      organization_types:organization_types!organizations_category_id_fkey(id, name, slug),
      media_assets(id, bucket_id, storage_path, purpose, sort_order, deleted_at)
    `)
    .eq("id", organizationId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const organization = data as BusinessOrganization;

  for (const asset of organization.media_assets) {
    if (asset.deleted_at || !["organization_logo", "organization_cover"].includes(asset.purpose)) {
      continue;
    }

    const { data: signedImage } = await supabase.storage
      .from(asset.bucket_id)
      .createSignedUrl(asset.storage_path, 60 * 10);

    if (asset.purpose === "organization_logo") {
      organization.logoUrl = signedImage?.signedUrl;
    } else {
      organization.coverUrl = signedImage?.signedUrl;
    }
  }

  return organization;
}

export async function getPublicationCategories() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("publication_categories")
    .select("id, slug, name, description, sort_order, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return data ?? [];
}

export async function getBusinessOverview(organizationId: string) {
  const organization = await getBusinessOrganization(organizationId);

  if (!organization) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { count: activePublications },
    { count: menuItems },
    { data: upcomingPublications },
    { data: expiringPublicationRows },
    { data: linkedApplications },
    analytics
  ] = await Promise.all([
    supabase
      .from("publications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["published", "scheduled", "cancelled"]),
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
      .limit(3),
    supabase
      .from("publications")
      .select("id, type, ends_at, valid_until")
      .eq("organization_id", organizationId)
      .in("status", ["published", "scheduled"])
      .or(`and(type.eq.event,ends_at.gte.${now.toISOString()},ends_at.lte.${inSevenDays}),and(type.neq.event,valid_until.gte.${now.toISOString()},valid_until.lte.${inSevenDays})`),
    supabase
      .from("organization_applications")
      .select("admin_comment, updated_at")
      .eq("organization_id", organizationId)
      .not("admin_comment", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1),
    getBusinessAnalyticsSummary(organizationId)
  ]);

  const profileFields = [
    organization.description,
    organization.address,
    organization.phone,
    organization.working_hours
  ];
  const mediaPurposes = new Set(
    organization.media_assets
      .filter((asset) => !asset.deleted_at)
      .map((asset) => asset.purpose)
  );
  const completedProfileParts = profileFields.filter(Boolean).length
    + (mediaPurposes.has("organization_logo") ? 1 : 0)
    + (mediaPurposes.has("organization_cover") ? 1 : 0)
    + (
      organization.latitude !== null && organization.longitude !== null
        ? 1
        : 0
    )
    + (
      typeof organization.contact_links === "object"
        && organization.contact_links !== null
        && !Array.isArray(organization.contact_links)
        && Object.values(organization.contact_links).some(Boolean)
        ? 1
        : 0
    );

  return {
    organization,
    activePublications: activePublications ?? 0,
    expiringPublications: expiringPublicationRows?.length ?? 0,
    menuItems: menuItems ?? 0,
    upcomingPublications: upcomingPublications ?? [],
    profileCompleteness: Math.round(completedProfileParts / 8 * 100),
    adminComment: linkedApplications?.[0]?.admin_comment ?? null,
    analytics
  };
}

export async function getBusinessAnalyticsSummary(organizationId: string) {
  const membership = await assertBusinessMembership(organizationId);

  if (!membership) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { count: organizationViews },
    { count: publicationViews },
    { count: phoneClicks },
    { count: routeClicks },
    { count: menuOpens },
    { count: favoriteAdds },
    { count: organizationClicks },
    { count: shares },
    { count: calendars }
  ] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_name", "organization_view")
      .gte("created_at", since),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_name", "publication_view")
      .gte("created_at", since),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_name", "phone_click")
      .gte("created_at", since),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_name", "route_click")
      .gte("created_at", since),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_name", "menu_open")
      .gte("created_at", since),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_name", "favorite_add")
      .gte("created_at", since),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_name", "organization_click")
      .gte("created_at", since),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_name", "share")
      .gte("created_at", since),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_name", "calendar")
      .gte("created_at", since)
  ]);

  return {
    organizationViews: organizationViews ?? 0,
    publicationViews: publicationViews ?? 0,
    phoneClicks: phoneClicks ?? 0,
    routeClicks: routeClicks ?? 0,
    menuOpens: menuOpens ?? 0,
    favoriteAdds: favoriteAdds ?? 0,
    organizationClicks: organizationClicks ?? 0,
    shares: shares ?? 0,
    calendars: calendars ?? 0
  };
}

export async function getBusinessPublications(
  organizationId: string,
  filters: {
    status?: TablesUpdate<"publications">["status"];
    type?: TablesUpdate<"publications">["type"];
    query?: string;
  } = {}
) {
  const membership = await assertBusinessMembership(organizationId);

  if (!membership) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("publications")
    .select(`
      *,
      publication_categories(id, name, slug),
      publication_schedules(id, schedule_text, weekday, starts_at, ends_at, sort_order, timezone),
      media_assets(id, bucket_id, storage_path, purpose, sort_order, deleted_at)
    `)
    .eq("organization_id", organizationId);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.type) {
    query = query.eq("type", filters.type);
  }

  if (filters.query) {
    query = query.ilike("title", `%${filters.query.replace(/[%_]/g, "")}%`);
  }

  const { data } = await query.order("updated_at", { ascending: false });

  return (data ?? []) as BusinessPublication[];
}

export async function getBusinessPublication(organizationId: string, publicationId: string) {
  const membership = await assertBusinessMembership(organizationId);
  const parsedPublicationId = uuidSchema.safeParse(publicationId);

  if (!membership || !parsedPublicationId.success) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publications")
    .select(`
      *,
      publication_categories(id, name, slug),
      publication_schedules(id, schedule_text, weekday, starts_at, ends_at, sort_order, timezone),
      media_assets(id, bucket_id, storage_path, purpose, sort_order, deleted_at)
    `)
    .eq("organization_id", organizationId)
    .eq("id", parsedPublicationId.data)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const publication = data as BusinessPublication;
  const imageAsset = publication.media_assets
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .find((asset) => asset.purpose === "publication_photo" && !asset.deleted_at);

  if (imageAsset) {
    const { data: signedImage } = await supabase.storage
      .from(imageAsset.bucket_id)
      .createSignedUrl(imageAsset.storage_path, 60 * 10);
    publication.imageUrl = signedImage?.signedUrl;
  }

  return publication;
}

export async function getBusinessMenu(organizationId: string) {
  const membership = await assertBusinessMembership(organizationId);

  if (!membership) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("menu_categories")
    .select(`
      *,
      menu_items(
        *,
        media_assets(id, bucket_id, storage_path, purpose, sort_order, deleted_at)
      )
    `)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  const categories = (data ?? []) as BusinessMenuCategory[];

  await Promise.all(categories.flatMap((category) => category.menu_items.map(async (item) => {
    const asset = item.media_assets
      .filter((candidate) => candidate.purpose === "menu_item_photo" && !candidate.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order)[0];

    if (!asset) {
      return;
    }

    const { data: signedImage } = await supabase.storage
      .from(asset.bucket_id)
      .createSignedUrl(asset.storage_path, 60 * 10);
    item.imageUrl = signedImage?.signedUrl;
  })));

  return categories;
}

export async function getBusinessMembers(organizationId: string) {
  const membership = await assertBusinessMembership(organizationId);

  if (!membership) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: representatives }, { data: invitations }] = await Promise.all([
    supabase.rpc("list_organization_representatives", {
      p_organization_id: organizationId
    }),
    membership.role === "owner"
      ? supabase
          .from("organization_member_invitations")
          .select("id, email, role, status, expires_at, created_at")
          .eq("organization_id", organizationId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] })
  ]);

  return {
    currentUserId: membership.user_id,
    currentRole: membership.role,
    representatives: (representatives ?? []) as OrganizationRepresentative[],
    invitations: (invitations ?? []) as OrganizationInvitation[]
  };
}

const invitationSchema = z.object({
  organizationId: uuidSchema,
  email: z.string().trim().email().max(320),
  role: z.enum(["owner", "manager"])
});

export async function inviteOrganizationRepresentativeAction(
  _state: BusinessActionState,
  formData: FormData
): Promise<BusinessActionState> {
  const parsed = invitationSchema.safeParse({
    organizationId: getString(formData, "organizationId"),
    email: getString(formData, "email"),
    role: getString(formData, "role")
  });

  if (!parsed.success) {
    return actionError("Укажите корректный email и роль представителя.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("invite_organization_representative", {
    p_organization_id: parsed.data.organizationId,
    p_email: parsed.data.email,
    p_role: parsed.data.role
  });

  if (error || typeof data !== "object" || data === null || Array.isArray(data)) {
    return actionError(
      error?.message.includes("already an active")
        ? "Пользователь с этим email уже имеет активный доступ."
        : "Не получилось создать приглашение."
    );
  }

  const token = "token" in data && typeof data.token === "string" ? data.token : null;

  if (!token) {
    return actionError("Приглашение создано, но ссылку получить не удалось.");
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
    ?? (host ? `${protocol}://${host}` : "http://localhost:3000");

  revalidatePath(`/business/${parsed.data.organizationId}/settings`);
  return {
    ...actionSuccess("Приглашение создано. Передайте ссылку указанному представителю."),
    invitationUrl: `${origin}/invitations/${token}`
  };
}

export async function manageOrganizationRepresentativeAction(formData: FormData) {
  const parsed = z.object({
    organizationId: uuidSchema,
    memberId: uuidSchema,
    action: z.enum(["activate", "deactivate", "change_role"]),
    role: z.enum(["owner", "manager"]).optional()
  }).safeParse({
    organizationId: getString(formData, "organizationId"),
    memberId: getString(formData, "memberId"),
    action: getString(formData, "action"),
    role: getString(formData, "role") || undefined
  });

  if (!parsed.success) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("manage_organization_representative", {
    p_organization_id: parsed.data.organizationId,
    p_member_id: parsed.data.memberId,
    p_action: parsed.data.action,
    p_role: parsed.data.role ?? null
  });
  revalidatePath(`/business/${parsed.data.organizationId}/settings`);
}

export async function transferOrganizationOwnershipAction(formData: FormData) {
  const parsed = z.object({
    organizationId: uuidSchema,
    memberId: uuidSchema
  }).safeParse({
    organizationId: getString(formData, "organizationId"),
    memberId: getString(formData, "memberId")
  });

  if (!parsed.success) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("transfer_organization_ownership", {
    p_organization_id: parsed.data.organizationId,
    p_target_member_id: parsed.data.memberId,
    p_keep_current_owner: false
  });

  revalidatePath(`/business/${parsed.data.organizationId}/settings`);
}

export async function revokeOrganizationInvitationAction(formData: FormData) {
  const parsed = z.object({
    organizationId: uuidSchema,
    invitationId: uuidSchema
  }).safeParse({
    organizationId: getString(formData, "organizationId"),
    invitationId: getString(formData, "invitationId")
  });

  if (!parsed.success) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("revoke_organization_invitation", {
    p_invitation_id: parsed.data.invitationId
  });
  revalidatePath(`/business/${parsed.data.organizationId}/settings`);
}

export async function acceptOrganizationInvitationAction(formData: FormData) {
  const token = getString(formData, "token");
  const parsed = z.string().regex(/^[a-f0-9]{64}$/).safeParse(token);

  if (!parsed.success) {
    redirect("/business?invitation=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_organization_invitation", {
    p_token: parsed.data
  });

  if (
    error
    || typeof data !== "object"
    || data === null
    || Array.isArray(data)
    || !("organization_id" in data)
    || typeof data.organization_id !== "string"
  ) {
    redirect(`/invitations/${parsed.data}?error=1`);
  }

  revalidatePath("/business");
  redirect(`/business/${data.organization_id}`);
}

export async function updateOrganizationProfileAction(
  _state: BusinessActionState,
  formData: FormData
): Promise<BusinessActionState> {
  const intent = getString(formData, "intent") || "save";
  const organizationId = getString(formData, "organizationId");

  if (intent === "remove-logo" || intent === "remove-cover") {
    const parsedId = uuidSchema.safeParse(organizationId);
    return parsedId.success
      ? removeOrganizationImage(
          parsedId.data,
          intent === "remove-logo" ? "organization_logo" : "organization_cover"
        )
      : actionError("Организация не найдена.");
  }

  const uploadField = intent === "upload-logo"
    ? "logo"
    : intent === "upload-cover"
      ? "cover"
      : null;
  const uploadFileValue = uploadField ? formData.get(uploadField) : null;
  const uploadFile = uploadFileValue instanceof File && uploadFileValue.size > 0
    ? uploadFileValue
    : null;

  if (uploadField) {
    const imageError = validatePublicationImage(uploadFile);

    if (imageError) {
      return actionError(imageError);
    }
  }

  const parsed = profileSchema.safeParse({
    organizationId,
    typeId: getString(formData, "typeId"),
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    address: getString(formData, "address"),
    phone: getString(formData, "phone"),
    workingHours: getString(formData, "workingHours"),
    latitude: getString(formData, "latitude"),
    longitude: getString(formData, "longitude"),
    website: getString(formData, "website"),
    telegram: getString(formData, "telegram"),
    vk: getString(formData, "vk")
  });

  if (!parsed.success) {
    return actionError("Проверьте данные профиля организации.");
  }

  const membership = await assertBusinessMembership(parsed.data.organizationId);

  if (!membership) {
    return actionError("Нет доступа к этой организации.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: updatedOrganization, error } = await supabase.rpc("update_member_organization_profile_v2", {
    p_organization_id: parsed.data.organizationId,
    p_type_id: parsed.data.typeId,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_address: parsed.data.address,
    p_phone: parsed.data.phone,
    p_working_hours: parsed.data.workingHours ?? "",
    p_latitude: parsed.data.latitude === "" ? null : parsed.data.latitude,
    p_longitude: parsed.data.longitude === "" ? null : parsed.data.longitude,
    p_contact_links: {
      ...(parsed.data.website ? { website: parsed.data.website } : {}),
      ...(parsed.data.telegram ? { telegram: parsed.data.telegram } : {}),
      ...(parsed.data.vk ? { vk: parsed.data.vk } : {})
    }
  });

  if (error) {
    return actionError("Не получилось обновить профиль организации.");
  }

  if (uploadField && uploadFile) {
    const purpose = uploadField === "logo" ? "organization_logo" : "organization_cover";
    const uploadResult = await replaceOrganizationImage(
      supabase,
      parsed.data.organizationId,
      purpose,
      uploadFile
    );

    if (uploadResult.error) {
      return actionError(uploadResult.error);
    }

    revalidatePath(`/business/${parsed.data.organizationId}/profile`);
    revalidatePath("/organizations");
    return {
      ...actionSuccess(uploadField === "logo" ? "Логотип обновлён." : "Обложка обновлена."),
      ...(uploadField === "logo"
        ? { logoUrl: uploadResult.imageUrl }
        : { coverUrl: uploadResult.imageUrl })
    };
  }

  revalidatePath(`/business/${parsed.data.organizationId}`);
  revalidatePath(`/business/${parsed.data.organizationId}/profile`);
  revalidatePath("/organizations");
  return actionSuccess(
    updatedOrganization?.pending_type_id
      ? "Профиль обновлён. Смена основного типа отправлена администратору на проверку."
      : "Профиль организации обновлён."
  );
}

export async function savePublicationAction(
  _state: BusinessActionState,
  formData: FormData
): Promise<BusinessActionState> {
  const rawIntent = getString(formData, "intent");
  const rawPublicationId = getString(formData, "publicationId");
  const rawOrganizationId = getString(formData, "organizationId");

  if (rawIntent === "remove-image") {
    const identifiers = z.object({
      organizationId: uuidSchema,
      publicationId: uuidSchema
    }).safeParse({
      organizationId: rawOrganizationId,
      publicationId: rawPublicationId
    });

    return identifiers.success
      ? removePublicationImage(identifiers.data.organizationId, identifiers.data.publicationId)
      : actionError("Сначала сохраните черновик публикации.");
  }

  const image = rawIntent === "upload-image" ? getPublicationImage(formData) : null;
  const imageValidationError = rawIntent === "upload-image"
    ? validatePublicationImage(image)
    : null;

  if (imageValidationError) {
    return actionError(imageValidationError);
  }

  const scheduleEntries = parseScheduleEntries(formData);

  if (!scheduleEntries) {
    return actionError("Не получилось прочитать расписание.");
  }

  const parsed = createPublicationInputSchema().safeParse({
    organizationId: rawOrganizationId,
    publicationId: rawPublicationId,
    clientRequestId: getString(formData, "clientRequestId"),
    intent: rawIntent === "upload-image"
      ? getString(formData, "uploadIntent") || "draft"
      : rawIntent,
    type: getString(formData, "type"),
    title: getString(formData, "title"),
    description: getString(formData, "description"),
    categoryId: getString(formData, "categoryId"),
    startsAt: toMoscowIsoOrOriginal(getString(formData, "startsAt")),
    endsAt: toMoscowIsoOrOriginal(getString(formData, "endsAt")),
    validUntil: toMoscowIsoOrOriginal(getString(formData, "validUntil")),
    publishAt: toMoscowIsoOrOriginal(getString(formData, "publishAt")),
    place: getString(formData, "place"),
    priceText: getString(formData, "priceText"),
    isFree: getBoolean(formData, "isFree"),
    ageLimit: getString(formData, "ageLimit"),
    contactPhone: getString(formData, "contactPhone"),
    scheduleEntries
  });

  if (!parsed.success) {
    return actionError(getFirstPublicationValidationError(parsed.error));
  }

  const supabase = await createSupabaseServerClient();
  const { data: publication, error } = await supabase.rpc("save_member_publication", {
    p_age_limit: toOptionalText(parsed.data.ageLimit),
    p_category_id: parsed.data.categoryId,
    p_client_request_id: parsed.data.clientRequestId,
    p_contact_phone: toOptionalText(parsed.data.contactPhone),
    p_description: toOptionalText(parsed.data.description),
    p_ends_at: toOptionalText(parsed.data.endsAt),
    p_intent: parsed.data.intent,
    p_is_free: parsed.data.isFree,
    p_organization_id: parsed.data.organizationId,
    p_place: toOptionalText(parsed.data.place),
    p_price_text: toOptionalText(parsed.data.priceText),
    p_publication_id: toOptionalText(parsed.data.publicationId),
    p_publish_at: toOptionalText(parsed.data.publishAt),
    p_schedule_entries: parsed.data.scheduleEntries.map((entry) => ({
      schedule_text: entry.scheduleText,
      weekday: entry.weekday,
      starts_at: entry.startsAt,
      ends_at: entry.endsAt,
      sort_order: entry.sortOrder,
      timezone: entry.timezone
    })) satisfies Json,
    p_starts_at: toOptionalText(parsed.data.startsAt),
    p_title: parsed.data.title,
    p_type: parsed.data.type,
    p_valid_until: toOptionalText(parsed.data.validUntil)
  });

  if (error || !publication) {
    return actionError(getPublicationRpcError(error?.message ?? ""));
  }
  const publicationHref = publication.status === "published" || publication.status === "cancelled"
    ? `/publications/${publication.slug}`
    : undefined;

  if (rawIntent === "upload-image" && image) {
    const imageResult = await replacePublicationImage(supabase, publication.id, image);

    if (imageResult.error) {
      return {
        ...actionError(imageResult.error),
        publicationId: publication.id
      };
    }

    revalidatePath(`/business/${parsed.data.organizationId}/publications/${publication.id}`);
    revalidatePath("/");
    return {
      ...actionSuccess("Изображение загружено. Введённые данные сохранены."),
      publicationId: publication.id,
      ...(publicationHref ? { publicationHref } : {}),
      imageUrl: imageResult.imageUrl
    };
  }

  revalidatePath(`/business/${parsed.data.organizationId}`);
  revalidatePath(`/business/${parsed.data.organizationId}/publications`);
  revalidatePath("/");
  const message = parsed.data.intent === "draft"
    ? "Черновик сохранён."
    : parsed.data.intent === "schedule"
      ? "Публикация запланирована."
      : "Публикация опубликована.";

  return {
    ...actionSuccess(message),
    publicationId: publication.id,
    ...(publicationHref ? { publicationHref } : {})
  };
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

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("transition_member_publication", {
    p_publication_id: parsed.data.publicationId,
    p_transition: parsed.data.status === "cancelled" ? "cancel" : "complete"
  });

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
    name: parsed.data.name,
    description: parsed.data.description || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive
  } satisfies TablesUpdate<"menu_categories">;

  const { error } = parsed.data.categoryId
    ? await supabase
        .from("menu_categories")
        .update(payload)
        .eq("id", parsed.data.categoryId)
        .eq("organization_id", parsed.data.organizationId)
    : await supabase.from("menu_categories").insert({
        ...payload,
        organization_id: parsed.data.organizationId
      } satisfies TablesInsert<"menu_categories">);

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
  const intent = getString(formData, "intent") || "save";
  const image = intent === "upload-image" ? getPublicationImage(formData) : null;
  const imageValidationError = intent === "upload-image"
    ? validatePublicationImage(image)
    : null;

  if (imageValidationError) {
    return actionError(imageValidationError);
  }

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

  if (parsed.data.categoryId) {
    const { data: category } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("id", parsed.data.categoryId)
      .eq("organization_id", parsed.data.organizationId)
      .maybeSingle();

    if (!category) {
      return actionError("Выбранный раздел меню не найден.");
    }
  }

  const payload = {
    category_id: parsed.data.categoryId || null,
    title: parsed.data.title,
    description: parsed.data.description || null,
    price_text: parsed.data.priceText || null,
    sort_order: parsed.data.sortOrder,
    is_available: parsed.data.isAvailable
  } satisfies TablesUpdate<"menu_items">;

  const result = parsed.data.itemId
    ? await supabase
        .from("menu_items")
        .update(payload)
        .eq("id", parsed.data.itemId)
        .eq("organization_id", parsed.data.organizationId)
        .select("id")
        .maybeSingle()
    : await supabase.from("menu_items").insert({
        ...payload,
        organization_id: parsed.data.organizationId
      } satisfies TablesInsert<"menu_items">)
        .select("id")
        .single();

  if (result.error || !result.data) {
    return actionError("Не получилось сохранить позицию меню.");
  }

  if (intent === "remove-image") {
    return removeMenuItemImage(parsed.data.organizationId, result.data.id);
  }

  if (intent === "upload-image" && image) {
    const imageResult = await replaceMenuItemImage(supabase, result.data.id, image);

    if (imageResult.error) {
      return actionError(imageResult.error);
    }

    revalidatePath(`/business/${parsed.data.organizationId}/menu`);
    revalidatePath("/organizations");
    return {
      ...actionSuccess("Позиция и изображение сохранены."),
      imageUrl: imageResult.imageUrl
    };
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
  const { data: assets } = await supabase
    .from("media_assets")
    .select("bucket_id, storage_path")
    .eq("menu_item_id", parsed.data.itemId)
    .is("deleted_at", null);
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", parsed.data.itemId)
    .eq("organization_id", parsed.data.organizationId);

  if (!error) {
    await Promise.all(
      (assets ?? []).map((asset) =>
        supabase.storage.from(asset.bucket_id).remove([asset.storage_path])
      )
    );
  }

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
