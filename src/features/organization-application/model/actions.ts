"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { Tables } from "@/shared/api/supabase/database.types";
import type { OrganizationMembership } from "@/entities/organization-application/model/types";
import type { ApplicationFormState } from "@/features/organization-application/model/types";

const applicationSchema = z.object({
  applicationId: z.string().uuid().optional().or(z.literal("")),
  organizationName: z.string().trim().min(2).max(160),
  categoryId: z.string().uuid(),
  description: z.string().trim().min(10).max(2000),
  address: z.string().trim().min(3).max(300),
  phone: z.string().trim().min(5).max(80),
  relationship: z.string().trim().min(3).max(500),
  confirmationInfo: z.string().trim().max(2000).optional()
});

type BusinessState = {
  user: {
    id: string;
    email: string | null;
    emailConfirmedAt: string | null;
  };
  profile: Pick<Tables<"profiles">, "id" | "role" | "display_name" | "phone"> | null;
  memberships: OrganizationMembership[];
  application: Tables<"organization_applications"> | null;
};

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const applicationFieldErrorMessages: Record<string, string> = {
  organizationName: "Укажите название организации: минимум 2 символа.",
  categoryId: "Выберите активную категорию из списка.",
  description: "Добавьте краткое описание: минимум 10 символов.",
  address: "Укажите адрес: минимум 3 символа.",
  phone: "Укажите контактный телефон: минимум 5 символов.",
  relationship: "Укажите вашу связь с организацией: минимум 3 символа.",
  confirmationInfo: "Подтверждающая информация должна быть не длиннее 2000 символов."
};

function formError(
  message = "Проверьте отмеченные поля и попробуйте снова.",
  fieldErrors?: Record<string, string>
): ApplicationFormState {
  return {
    status: "error",
    message,
    fieldErrors
  } satisfies ApplicationFormState;
}

function validationError(error: z.ZodError): ApplicationFormState {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (typeof fieldName !== "string" || fieldErrors[fieldName]) {
      continue;
    }

    fieldErrors[fieldName] = applicationFieldErrorMessages[fieldName] ?? "Проверьте значение поля.";
  }

  return formError("Проверьте отмеченные поля и попробуйте снова.", fieldErrors);
}

export async function getCurrentBusinessState(): Promise<BusinessState | null> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return null;
  }

  const [{ data: profile }, { data: memberships }, { data: applications }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, display_name, phone")
      .eq("id", userData.user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("id, organization_id, user_id, role, is_active, created_at, updated_at, organizations(id, name, slug, status)")
      .eq("user_id", userData.user.id)
      .eq("is_active", true),
    supabase
      .from("organization_applications")
      .select("*")
      .eq("applicant_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
  ]);

  return {
    user: {
      id: userData.user.id,
      email: userData.user.email ?? null,
      emailConfirmedAt: userData.user.email_confirmed_at ?? null
    },
    profile,
    memberships: (memberships ?? []) as OrganizationMembership[],
    application: applications?.[0] ?? null
  };
}

export async function getOrganizationCategories() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_categories")
    .select("id, slug, name, description, sort_order, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return data ?? [];
}

async function saveApplication(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return { error: formError("Войдите, чтобы заполнить заявку.") };
  }

  const parsed = applicationSchema.safeParse({
    applicationId: getString(formData, "applicationId"),
    organizationName: getString(formData, "organizationName"),
    categoryId: getString(formData, "categoryId"),
    description: getString(formData, "description"),
    address: getString(formData, "address"),
    phone: getString(formData, "phone"),
    relationship: getString(formData, "relationship"),
    confirmationInfo: getString(formData, "confirmationInfo")
  });

  if (!parsed.success) {
    return { error: validationError(parsed.error) };
  }

  const { data: category } = await supabase
    .from("organization_categories")
    .select("id, name")
    .eq("id", parsed.data.categoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (!category) {
    return {
      error: formError("Проверьте отмеченные поля и попробуйте снова.", {
        categoryId: applicationFieldErrorMessages.categoryId
      })
    };
  }

  const payload = {
    organization_name: parsed.data.organizationName,
    category_id: parsed.data.categoryId,
    category_name: category.name,
    description: parsed.data.description,
    address: parsed.data.address,
    phone: parsed.data.phone,
    relationship: parsed.data.relationship,
    confirmation_info: parsed.data.confirmationInfo || null
  };

  if (parsed.data.applicationId) {
    const { data: existing } = await supabase
      .from("organization_applications")
      .select("id, status")
      .eq("id", parsed.data.applicationId)
      .eq("applicant_id", userData.user.id)
      .maybeSingle();

    if (!existing || !["draft", "needs_changes"].includes(existing.status)) {
      return { error: formError("Эту заявку уже нельзя редактировать.") };
    }

    const { data, error } = await supabase
      .from("organization_applications")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      return { error: formError("Не получилось сохранить заявку.") };
    }

    return { application: data };
  }

  const { data, error } = await supabase
    .from("organization_applications")
    .insert({
      ...payload,
      applicant_id: userData.user.id,
      status: "draft"
    })
    .select("*")
    .single();

  if (error) {
    return { error: formError("Не получилось создать заявку. Возможно, такая активная заявка уже есть.") };
  }

  return { application: data };
}

export async function saveOrganizationApplicationDraftAction(
  _state: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const result = await saveApplication(formData);

  if (result.error) {
    return result.error;
  }

  revalidatePath("/business");
  revalidatePath("/business/application");

  return {
    status: "success",
    message: "Черновик заявки сохранен."
  } satisfies ApplicationFormState;
}

export async function submitOrganizationApplicationAction(
  _state: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const result = await saveApplication(formData);

  if (result.error) {
    return result.error;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_organization_application", {
    application_id: result.application.id
  });

  if (error) {
    return formError(
      "Не получилось отправить заявку. Проверьте обязательные поля или сохраните черновик и попробуйте снова."
    );
  }

  revalidatePath("/business");
  revalidatePath("/business/application");
  redirect("/business");
}
