"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { Tables } from "@/shared/api/supabase/database.types";
import type { OrganizationMembership } from "@/entities/organization-application/model/types";
import {
  applicationFieldErrorMessages,
  type ApplicationFieldName,
  type ApplicationFormState
} from "@/features/organization-application/model/types";

const postgresUuidSchema = z.string().trim().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
);

const applicationSchema = z.object({
  applicationId: postgresUuidSchema.optional().or(z.literal("")),
  organizationName: z.string().trim().min(2).max(160),
  typeId: postgresUuidSchema,
  description: z.string().trim().min(10).max(2000),
  address: z.string().trim().min(3).max(300).optional().or(z.literal("")),
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
  applications: Tables<"organization_applications">[];
  application: Tables<"organization_applications"> | null;
};

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function formError(
  message = "Проверьте отмеченные поля и попробуйте снова.",
  fieldErrors?: Partial<Record<ApplicationFieldName, string>>
): ApplicationFormState {
  return {
    status: "error",
    message,
    fieldErrors
  } satisfies ApplicationFormState;
}

function logApplicationActionError(context: string, error: unknown) {
  if (!error || typeof error !== "object") {
    console.error(`[organization-application] ${context}`, error);
    return;
  }

  const details = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };

  console.error(`[organization-application] ${context}`, {
    code: details.code,
    message: details.message,
    details: details.details,
    hint: details.hint
  });
}

function isDuplicateApplicationError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "23505" ||
    Boolean(error?.message?.includes("organization_applications_one_active_name_idx"))
  );
}

function validationError(error: z.ZodError): ApplicationFormState {
  const fieldErrors: Partial<Record<ApplicationFieldName, string>> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path[0];

    if (
      typeof fieldName !== "string" ||
      !(fieldName in applicationFieldErrorMessages) ||
      fieldErrors[fieldName as ApplicationFieldName]
    ) {
      continue;
    }

    fieldErrors[fieldName as ApplicationFieldName] =
      applicationFieldErrorMessages[fieldName as ApplicationFieldName];
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
  ]);

  return {
    user: {
      id: userData.user.id,
      email: userData.user.email ?? null,
      emailConfirmedAt: userData.user.email_confirmed_at ?? null
    },
    profile,
    memberships: (memberships ?? []) as OrganizationMembership[],
    applications: applications ?? [],
    application: applications?.[0] ?? null
  };
}

export async function getOrganizationTypes() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_types")
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
    typeId: getString(formData, "typeId"),
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
    .from("organization_types")
    .select("id, name")
    .eq("id", parsed.data.typeId)
    .eq("is_active", true)
    .maybeSingle();

  if (!category) {
    return {
      error: formError("Проверьте отмеченные поля и попробуйте снова.", {
        typeId: "Выбранный тип организации не найден или отключен. Выберите тип организации заново."
      })
    };
  }

  const payload = {
    organization_name: parsed.data.organizationName,
    type_id: parsed.data.typeId,
    description: parsed.data.description,
    address: parsed.data.address || null,
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
      logApplicationActionError("update failed", error);
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
    logApplicationActionError("insert failed", error);

    if (isDuplicateApplicationError(error)) {
      return {
        error: formError(
          "У вас уже есть активная заявка с таким названием организации. Откройте существующую заявку или измените название.",
          {
            organizationName: "Активная заявка с таким названием уже существует."
          }
        )
      };
    }

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
    message: "Черновик заявки сохранен.",
    applicationId: result.application.id
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
    logApplicationActionError("submit rpc failed", error);

    return formError(
      "Не получилось отправить заявку. Проверьте обязательные поля или сохраните черновик и попробуйте снова."
    );
  }

  revalidatePath("/business");
  revalidatePath("/business/application");
  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  redirect("/business?application=submitted");
}
