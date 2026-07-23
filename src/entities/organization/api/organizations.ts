import { createSupabasePublicServerClient } from "@/shared/api/supabase/public-server";
import type { Database, Tables } from "@/shared/api/supabase/database.types";
import {
  getStableOpenGraphImage,
  type PublicOrganizationSeo
} from "@/shared/lib/seo";
import type {
  Organization,
  OrganizationTypeOption,
  OrganizationService
} from "@/entities/organization/model/types";
import type { OrganizationCatalogFilters } from "@/entities/organization/model/catalog-filters";
import { isOrganizationType } from "@/entities/organization/model/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type OrganizationRow = Tables<"organizations"> & {
  organization_types: Pick<Tables<"organization_types">, "slug" | "name"> | null;
  media_assets: Array<Pick<Tables<"media_assets">, "bucket_id" | "storage_path" | "purpose" | "sort_order">>;
};

type MenuItemRow = Pick<
  Tables<"menu_items">,
  "id" | "title" | "description" | "price_text" | "is_available" | "sort_order"
>;

type OrganizationTypeRow = Pick<Tables<"organization_types">, "id" | "slug" | "name">;

type SeoMediaAsset = Pick<
  Tables<"media_assets">,
  "storage_path" | "purpose" | "sort_order" | "visibility"
>;

type OrganizationSeoRow = Pick<Tables<"organizations">, "slug" | "name" | "description"> & {
  media_assets: SeoMediaAsset[];
};

const organizationSelect = "*, organization_types(slug, name), media_assets(bucket_id, storage_path, purpose, sort_order)";
const organizationSeoSelect = "slug, name, description, media_assets(storage_path, purpose, sort_order, visibility)";

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

async function mapOrganization(
  supabase: SupabaseClient<Database>,
  row: OrganizationRow,
  services: OrganizationService[] = [],
  activePublicationIds: string[] = []
): Promise<Organization> {
  const sortedAssets = row.media_assets
    .slice()
    .filter((asset) => asset.storage_path)
    .sort((a, b) => a.sort_order - b.sort_order);
  const logo = sortedAssets.find((asset) => asset.purpose === "organization_logo");
  const cover = sortedAssets.find((asset) => asset.purpose === "organization_cover");

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: isOrganizationType(row.organization_types?.slug)
      ? row.organization_types.slug
      : "services",
    description: row.description ?? "",
    address: row.address ?? "Судак",
    phone: row.phone ?? "",
    workingHours: row.working_hours ?? "Уточняйте у организации",
    logo: await getImageUrl(supabase, logo),
    cover: await getImageUrl(supabase, cover),
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

function getOrganizationOpenGraphImage(mediaAssets: SeoMediaAsset[]) {
  const assets = mediaAssets
    .filter(
      (asset) =>
        asset.visibility === "public" &&
        (asset.purpose === "organization_logo" || asset.purpose === "organization_cover")
    )
    .sort((a, b) => {
      const purposeOrder = (asset: SeoMediaAsset) => (asset.purpose === "organization_logo" ? 0 : 1);

      return purposeOrder(a) - purposeOrder(b) || a.sort_order - b.sort_order;
    });

  return assets.map((asset) => getStableOpenGraphImage(asset.storage_path)).find(Boolean);
}

async function getActivePublicationIdsByOrganization(
  supabase: SupabaseClient<Database>,
  organizationIds: string[]
) {
  const ids = new Map<string, string[]>();

  if (!organizationIds.length) {
    return ids;
  }

  const { data } = await supabase
    .from("publications")
    .select("id, organization_id")
    .eq("status", "published")
    .in("organization_id", organizationIds);

  for (const publication of data ?? []) {
    const current = ids.get(publication.organization_id) ?? [];
    current.push(publication.id);
    ids.set(publication.organization_id, current);
  }

  return ids;
}

export async function listPublicOrganizationTypes() {
  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase
    .from("organization_types")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return { organizationTypes: [], error: "Не удалось загрузить категории организаций." };
  }

  const organizationTypes = ((data ?? []) as OrganizationTypeRow[]).flatMap((organizationType) =>
    isOrganizationType(organizationType.slug)
      ? [{ slug: organizationType.slug, name: organizationType.name } satisfies OrganizationTypeOption]
      : []
  );

  return { organizationTypes, error: null };
}

export async function listPublicOrganizations(filters: OrganizationCatalogFilters = {}) {
  const supabase = createSupabasePublicServerClient();
  let organizationQuery = supabase
    .from("organizations")
    .select(organizationSelect)
    .eq("status", "active")
    .order("name", { ascending: true });

  if (filters.query) {
    organizationQuery = organizationQuery.ilike("name", `%${filters.query}%`);
  }

  if (filters.type) {
    const { data: organizationType, error: organizationTypeError } = await supabase
      .from("organization_types")
      .select("id")
      .eq("slug", filters.type)
      .eq("is_active", true)
      .maybeSingle();

    if (organizationTypeError) {
      return { organizations: [], error: "Не удалось загрузить каталог организаций." };
    }

    if (organizationType) {
      organizationQuery = organizationQuery.eq("type_id", organizationType.id);
    }
  }

  const organizationsResult = await organizationQuery;

  if (organizationsResult.error) {
    return { organizations: [], error: "Не удалось загрузить каталог организаций." };
  }

  const organizationRows = (organizationsResult.data ?? []) as OrganizationRow[];
  const publicationIds = await getActivePublicationIdsByOrganization(
    supabase,
    organizationRows.map((organization) => organization.id)
  );

  const organizations = await Promise.all(
    organizationRows.map((organization) =>
      mapOrganization(supabase, organization, [], publicationIds.get(organization.id) ?? [])
    )
  );

  return { organizations, error: null };
}

export async function getPublicOrganizationBySlug(slug: string) {
  const supabase = createSupabasePublicServerClient();
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

export async function getPublicOrganizationSeoBySlug(slug: string) {
  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(organizationSeoSelect)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { organization: null, error: "Не удалось загрузить организацию." };
  }

  if (!data) {
    return { organization: null, error: null };
  }

  const organization = data as OrganizationSeoRow;

  return {
    organization: {
      slug: organization.slug,
      name: organization.name,
      description: organization.description,
      image: getOrganizationOpenGraphImage(organization.media_assets ?? [])
    } satisfies PublicOrganizationSeo,
    error: null
  };
}
