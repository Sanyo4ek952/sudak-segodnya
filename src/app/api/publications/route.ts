import { NextResponse } from "next/server";
import { listPublicPublications } from "@/entities/publication/api/publications";
import { normalizePublicationFilter } from "@/entities/publication/model/filters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter = normalizePublicationFilter({
    filter: url.searchParams.get("filter") ?? undefined
  });
  const cursor = url.searchParams.get("cursor");
  const result = await listPublicPublications({ filter, cursor });

  return NextResponse.json(result, {
    status: result.error ? 503 : 200,
    headers: {
      "Cache-Control": "private, no-store"
    }
  });
}
