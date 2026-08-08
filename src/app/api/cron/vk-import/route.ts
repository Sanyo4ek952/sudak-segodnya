import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { invokeVkImport } from "@/features/vk-import/server/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function matchesSecret(value: string | null, expected: string | undefined) {
  if (!value?.startsWith("Bearer ") || !expected) return false;
  const received = new TextEncoder().encode(value.slice(7));
  const configured = new TextEncoder().encode(expected);
  return received.length === configured.length && timingSafeEqual(received, configured);
}

export async function GET(request: Request) {
  if (!matchesSecret(request.headers.get("authorization"), process.env.CRON_SECRET?.trim())) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  try {
    const result = await invokeVkImport();
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "VK import failed" }, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" }
    });
  }
}
