import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import type { Database, Tables } from "@/shared/api/supabase/database.types";
import type {
  Organization,
  OrganizationCategory,
  OrganizationService
} from "@/entities/organization/model/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type OrganizationRow = Tables<"organizations"> & {
  organization_categories: Pick<Tables<"organization_categories">, "slug" | "name"> | null;
};

type MenuItemRow = Pick<
  Tables<"menu_items">,
  "id" | "title" | "description" | "price_text" | "is_available" | "sort_order"
>;

const organizationSelect = "*, organization_categories(slug, name)";

function isOrganizationCategory(value: string | null | undefined): value is OrganizationCategory {
  return (
    value === "food" ||
    value === "delivery" ||
    value === "kids" ||
    value === "culture" ||
    value === "excursions" ||
    value === "rental" ||
    value === "shops" ||
    value === "services"
  );
}

async function getImageUrl(
  supabase: SupabaseClient<Database>,
  path: string | null
) {
  if (!path) {
    return undefined;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const { data, error } = await supabase.storage.from("organization-images").createSignedUrl(path, 60 * 10);

  if (error) {
    return undefined;
  }

  return data.signedUrl;
}

async function mapOrganization(
  supabase: SupabaseClient<Database>,
  row: OrganizationRow,
  services: OrganizationService[] = [],
  activePublicationIds: string[] = []
): Promise<Organization> {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: isOrganizationCategory(row.organization_categories?.slug)
      ? row.organization_categories.slug
      : "services",
    description: row.description ?? "",
    address: row.address ?? "Судак",
    phone: row.phone ?? "",
    workingHours: row.working_hours ?? "Уточняйте у организации",
    logo: await getImageUrl(supabase, row.logo_path),
    cover: await getImageUrl(supabase, row.cover_path),
    services,
    activePublicationIds,
    updatedAt: row.last_public_update_at ?? row.updated_at
  };
}

function mapService(row: MenuItemRow): OrganizationService {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    priceText: row.price_text ?? "Уточняйте",
    isAvailable: row.is_available
  };
}

async function getActivePublicationIdsByOrganization() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("publications").select("id, organization_id");
  const ids = new Map<string, string[]>();

  for (const publication of data ?? []) {
    const current = ids.get(publication.organization_id) ?? [];
    current.push(publication.id);
    ids.set(publication.organization_id, current);
  }

  return ids;
}

export async function listPublicOrganizations() {
  const supabase = await createSupabaseServerClient();
  const [organizationsResult, publicationIds] = await Promise.all([
    supabase.from("organizations").select(organizationSelect).order("name", { ascending: true }),
    getActivePublicationIdsByOrganization()
  ]);

  if (organizationsResult.error) {
    return { organizations: [], error: "Не удалось загрузить каталог организаций." };
  }

  const organizations = await Promise.all(
    ((organizationsResult.data ?? []) as OrganizationRow[]).map((organization) =>
      mapOrganization(supabase, organization, [], publicationIds.get(organization.id) ?? [])
    )
  );

  return { organizations, error: null };
}

export async function getPublicOrganizationBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(organizationSelect)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { organization: null, error: "Не удалось загрузить организацию." };
  }

  if (!data) {
    return { organization: null, error: null };
  }

  const [{ data: menuItems }, { data: publications }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, title, description, price_text, is_available, sort_order")
      .eq("organization_id", data.id)
      .order("sort_order", { ascending: true }),
    supabase.from("publications").select("id").eq("organization_id", data.id)
  ]);

  const services = ((menuItems ?? []) as MenuItemRow[]).map(mapService);
  const activePublicationIds = (publications ?? []).map((publication) => publication.id);

  return {
    organization: await mapOrganization(supabase, data as OrganizationRow, services, activePublicationIds),
    error: null
  };
}
