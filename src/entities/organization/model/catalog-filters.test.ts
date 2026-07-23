import { describe, expect, it } from "vitest";
import { normalizeOrganizationCatalogFilters } from "./catalog-filters";

describe("normalizeOrganizationCatalogFilters", () => {
  it("returns an empty filter set for empty parameters", () => {
    expect(normalizeOrganizationCatalogFilters({})).toEqual({});
  });

  it("trims and normalizes an organization name query", () => {
    expect(normalizeOrganizationCatalogFilters({ q: "  Новый   музей  " })).toEqual({
      query: "Новый музей"
    });
  });

  it("keeps a supported organization type", () => {
    expect(normalizeOrganizationCatalogFilters({ type: "culture" })).toEqual({ type: "culture" });
  });

  it("ignores an unknown organization type", () => {
    expect(normalizeOrganizationCatalogFilters({ type: "unknown" })).toEqual({});
  });

  it("combines a name query with an organization type", () => {
    expect(normalizeOrganizationCatalogFilters({ q: "Маяк", type: "food" })).toEqual({
      query: "Маяк",
      type: "food"
    });
  });
});
