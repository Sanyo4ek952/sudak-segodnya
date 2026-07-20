"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { AuthFormState } from "@/features/auth/model/types";

const emailSchema = z.string().trim().email("Укажите корректный email.");
const passwordSchema = z.string().min(8, "Пароль должен быть не короче 8 символов.");

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Введите пароль."),
  next: z.string().optional()
});

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().max(120).optional(),
  next: z.string().optional()
});

const forgotPasswordSchema = z.object({
  email: emailSchema
});

const updatePasswordSchema = z.object({
  password: passwordSchema,
  passwordConfirm: z.string()
}).refine((value) => value.password === value.passwordConfirm, {
  path: ["passwordConfirm"],
  message: "Пароли должны совпадать."
});

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getSafeNextPath(value: string | undefined, fallback = "/business") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  return value;
}

async function getOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function validationError() {
  return {
    status: "error",
    message: "Проверьте поля формы и попробуйте снова."
  } satisfies AuthFormState;
}

export async function loginAction(_state: AuthFormState, formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: getString(formData, "email"),
    password: getString(formData, "password"),
    next: getString(formData, "next")
  });

  if (!parsed.success) {
    return validationError();
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    return {
      status: "error",
      message: "Не получилось войти. Проверьте email и пароль."
    } satisfies AuthFormState;
  }

  redirect(getSafeNextPath(parsed.data.next));
}

export async function registerAction(_state: AuthFormState, formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: getString(formData, "email"),
    password: getString(formData, "password"),
    displayName: getString(formData, "displayName"),
    next: getString(formData, "next")
  });

  if (!parsed.success) {
    return validationError();
  }

  const origin = await getOrigin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(getSafeNextPath(parsed.data.next))}`,
      data: {
        display_name: parsed.data.displayName || undefined
      }
    }
  });

  if (error) {
    return {
      status: "error",
      message: "Не получилось создать аккаунт. Попробуйте другой email или повторите позже."
    } satisfies AuthFormState;
  }

  if (data.session) {
    redirect(getSafeNextPath(parsed.data.next));
  }

  return {
    status: "success",
    message: "Аккаунт создан. Если подтверждение email включено, откройте письмо и завершите вход."
  } satisfies AuthFormState;
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(_state: AuthFormState, formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({
    email: getString(formData, "email")
  });

  if (!parsed.success) {
    return validationError();
  }

  const origin = await getOrigin();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`
  });

  return {
    status: "success",
    message: "Если такой email зарегистрирован, на него придет ссылка для восстановления."
  } satisfies AuthFormState;
}

export async function updatePasswordAction(_state: AuthFormState, formData: FormData) {
  const parsed = updatePasswordSchema.safeParse({
    password: getString(formData, "password"),
    passwordConfirm: getString(formData, "passwordConfirm")
  });

  if (!parsed.success) {
    return validationError();
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return {
      status: "error",
      message: "Ссылка восстановления устарела. Запросите новую."
    } satisfies AuthFormState;
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password
  });

  if (error) {
    return {
      status: "error",
      message: "Не получилось обновить пароль. Запросите новую ссылку восстановления."
    } satisfies AuthFormState;
  }

  redirect("/business");
}
