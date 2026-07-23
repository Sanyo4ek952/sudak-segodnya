import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { Database, Tables } from "@/shared/api/supabase/database.types";
import type { Publication, PublicationStatus } from "@/entities/publication/model/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportantAnnouncement = {
  id: string;
  title: string;
  description: string;
  activeUntil: string | null;
  publicationSlug: string | null;
};

type PublicationRow = Tables<"publications"> & {
  organizations: Pick<Tables<"organizations">, "id" | "slug" | "name" | "address" | "phone"> | null;
  publication_categories: Pick<Tables<"publication_categories">, "slug" | "name"> | null;
  publication_schedules: Array<Pick<Tables<"publication_schedules">, "schedule_text" | "sort_order">>;
  media_assets: Array<Pick<Tables<"media_assets">, "bucket_id" | "storage_path" | "purpose" | "sort_order">>;
};

const publicationSelect = `
  *,
  organizations(id, slug, name, address, phone),
  publication_categories(slug, name),
  publication_schedules(schedule_text, sort_order),
  media_assets(bucket_id, storage_path, purpose, sort_order)
`;

async function getImageUrl(
  supabase: SupabaseClient<Database>,
  asset: Pick<Tables<"media_assets">, "bucket_id" | "storage_path"> | undefined
) {
  if (!asset) {
    return undefined;
  }

  if (asset.storage_path.startsWith("http://") || asset.storage_path.startsWith("https://")) {
    return asset.storage_path;
  }

  const { data, error } = await supabase.storage.from(asset.bucket_id).createSignedUrl(asset.storage_path, 60 * 10);

  if (error) {
    return undefined;
  }

  return data.signedUrl;
}

async function mapPublication(
  supabase: SupabaseClient<Database>,
  row: PublicationRow
): Promise<Publication | null> {
  if (!row.organizations) {
    return null;
  }

  const category = row.publication_categories?.slug ?? "services";
  const imageAsset = row.media_assets
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .find((asset) => asset.purpose === "publication_photo");
  const schedule = row.publication_schedules
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => item.schedule_text)
    .filter(Boolean)
    .join(", ");

  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    status: row.status as PublicationStatus,
    title: row.title,
    description: row.description ?? "",
    organization: {
      id: row.organizations.id,
      slug: row.organizations.slug,
      name: row.organizations.name
    },
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    validUntil: row.valid_until ?? undefined,
    schedule: schedule || undefined,
    place: row.place ?? row.organizations.address ?? "Судак",
    priceText: row.price_text ?? (row.is_free ? "Бесплатно" : "Уточняйте"),
    isFree: row.is_free,
    category,
    image: await getImageUrl(supabase, imageAsset),
    contactPhone: row.contact_phone ?? row.organizations.phone ?? undefined,
    ageLimit: row.age_limit ?? undefined,
    updatedAt: row.updated_at
  };
}

async function compactPublications(supabase: SupabaseClient<Database>, rows: PublicationRow[]) {
  const publications = await Promise.all(rows.map((row) => mapPublication(supabase, row)));

  return publications.filter((publication): publication is Publication => Boolean(publication));
}

export async function listPublicPublications() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publications")
    .select(publicationSelect)
    .order("sort_published_at", { ascending: false, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    return { publications: [], error: "Не удалось загрузить городскую ленту." };
  }

  return { publications: await compactPublications(supabase, (data ?? []) as PublicationRow[]), error: null };
}

export async function getPublicPublicationBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publications")
    .select(publicationSelect)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { publication: null, error: "Не удалось загрузить публикацию." };
  }

  return { publication: data ? await mapPublication(supabase, data as PublicationRow) : null, error: null };
}

export async function listPublicPublicationsByOrganization(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("publications")
    .select(publicationSelect)
    .eq("organization_id", organizationId)
    .order("sort_published_at", { ascending: false, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    return { publications: [], error: "Не удалось загрузить публикации организации." };
  }

  return { publications: await compactPublications(supabase, (data ?? []) as PublicationRow[]), error: null };
}

export async function getActiveImportantAnnouncement() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("important_announcements")
    .select("id, title, description, active_until, publications(slug)")
    .order("active_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { announcement: null, error: "Не удалось загрузить важное объявление." };
  }

  if (!data) {
    return { announcement: null, error: null };
  }

  const publication = Array.isArray(data.publications) ? data.publications[0] : data.publications;

  return {
    announcement: {
      id: data.id,
      title: data.title,
      description: data.description,
      activeUntil: data.active_until,
      publicationSlug: publication?.slug ?? null
    } satisfies ImportantAnnouncement,
    error: null
  };
}
