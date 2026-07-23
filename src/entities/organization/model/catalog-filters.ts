import { isOrganizationType, type OrganizationType } from "./types";

type CatalogSearchParam = string | string[] | undefined;

export type OrganizationCatalogSearchParams = {
  q?: CatalogSearchParam;
  type?: CatalogSearchParam;
};

export type OrganizationCatalogFilters = {
  query?: string;
  type?: OrganizationType;
};

export const organizationCatalogQueryMaxLength = 80;

function firstValue(value: CatalogSearchParam) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeOrganizationCatalogFilters(
  searchParams: OrganizationCatalogSearchParams
): OrganizationCatalogFilters {
  const query = firstValue(searchParams.q)
    ?.trim()
    .replace(/\s+/g, " ")
    .slice(0, organizationCatalogQueryMaxLength);
  const type = firstValue(searchParams.type);

  return {
    ...(query ? { query } : {}),
    ...(isOrganizationType(type) ? { type } : {})
  };
}
