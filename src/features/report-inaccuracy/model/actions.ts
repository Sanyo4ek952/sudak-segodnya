"use server";

import { cookies } from "next/headers";
import {
  createInaccuracyReportPayload,
  inaccuracyReportSchema
} from "@/features/report-inaccuracy/model/contract";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { InaccuracyReportState } from "@/features/report-inaccuracy/model/types";

function getString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function actionError(message: string): InaccuracyReportState {
  return { status: "error", message };
}

async function getReporterFingerprint() {
  const cookieStore = await cookies();
  const existing = cookieStore.get("sudak_reporter_id")?.value;

  if (existing) {
    return existing;
  }

  const fingerprint = crypto.randomUUID();
  cookieStore.set("sudak_reporter_id", fingerprint, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/"
  });

  return fingerprint;
}

export async function submitInaccuracyReportAction(
  _state: InaccuracyReportState,
  formData: FormData
): Promise<InaccuracyReportState> {
  const parsed = inaccuracyReportSchema.safeParse({
    publicationId: getString(formData, "publicationId"),
    reason: getString(formData, "reason"),
    comment: getString(formData, "comment")
  });

  if (!parsed.success) {
    return actionError("Проверьте причину сообщения и комментарий.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "create_inaccuracy_report",
    createInaccuracyReportPayload(parsed.data, await getReporterFingerprint())
  );

  if (error) {
    return actionError("Сообщение уже отправлено или лимит обращений временно исчерпан.");
  }

  return {
    status: "success",
    message: "Спасибо. Мы проверим информацию, но публикация не скрывается автоматически."
  };
}
