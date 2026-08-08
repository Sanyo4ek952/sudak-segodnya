import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { manualIngestionRequestSchema } from "@/features/content-ingestion/model/contracts";
import { processContentIngestionRequest } from "@/features/content-ingestion/server/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function matchesToken(request: Request) {
  const expected = process.env.INGESTION_SUBMIT_TOKEN?.trim();
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ") || !expected) return false;
  const received = new TextEncoder().encode(header.slice(7));
  const configured = new TextEncoder().encode(expected);
  return received.length === configured.length && timingSafeEqual(received, configured);
}

export async function POST(request: Request) {
  if (!matchesToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) {
    return NextResponse.json({ error: "Request body is too large" }, {
      status: 413,
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > 4096) {
    return NextResponse.json({ error: "Request body is too large" }, {
      status: 413,
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  })();
  const parsed = manualIngestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pass exactly one sourceId or url" }, {
      status: 400,
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  try {
    const result = await processContentIngestionRequest({ ...parsed.data, trigger: "agent" });
    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message.slice(0, 300) : "Content ingestion failed"
    }, {
      status: 422,
      headers: { "Cache-Control": "private, no-store" }
    });
  }
}
