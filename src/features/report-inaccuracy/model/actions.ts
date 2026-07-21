"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { InaccuracyReportState } from "@/features/report-inaccuracy/model/types";

const reportSchema = z.object({
  publicationId: z.string().uuid(),
  reason: z.enum(["wrong_time", "wrong_price", "cancelled", "wrong_address", "outdated", "other"]),
  comment: z.string().trim().max(1000).optional()
});

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
  const parsed = reportSchema.safeParse({
    publicationId: getString(formData, "publicationId"),
    reason: getString(formData, "reason"),
    comment: getString(formData, "comment")
  });

  if (!parsed.success) {
    return actionError("Проверьте причину сообщения и комментарий.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_inaccuracy_report", {
    publication_id: parsed.data.publicationId,
    reason: parsed.data.reason,
    comment: parsed.data.comment ?? "",
    reporter_fingerprint: await getReporterFingerprint()
  });

  if (error) {
    return actionError("Сообщение уже отправлено или лимит обращений временно исчерпан.");
  }

  return {
    status: "success",
    message: "Спасибо. Мы проверим информацию, но публикация не скрывается автоматически."
  };
}
