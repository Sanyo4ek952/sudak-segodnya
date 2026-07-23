import { NextResponse } from "next/server";
import { listPublicOrganizationsByIds } from "@/entities/organization/api/organizations";
import { listPublicPublicationsByIds } from "@/entities/publication/api/publications";
import { favoriteIdsSchema } from "@/features/save-favorite/model/favorites-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const parsed = favoriteIdsSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный список избранного." }, { status: 400 });
  }

  const [publicationResult, organizationResult] = await Promise.all([
    listPublicPublicationsByIds(parsed.data.publicationIds),
    listPublicOrganizationsByIds(parsed.data.organizationIds)
  ]);
  const error = publicationResult.error ?? organizationResult.error;

  return NextResponse.json(
    {
      publications: publicationResult.publications,
      organizations: organizationResult.organizations,
      error
    },
    {
      status: error ? 503 : 200,
      headers: {
        "Cache-Control": "private, no-store"
      }
    }
  );
}
