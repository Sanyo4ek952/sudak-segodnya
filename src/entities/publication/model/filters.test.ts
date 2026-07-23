import { describe, expect, it } from "vitest";
import { filterItems, normalizePublicationFilter } from "./filters";

describe("normalizePublicationFilter", () => {
  it("keeps every supported filter", () => {
    for (const { value } of filterItems) {
      expect(normalizePublicationFilter({ filter: value })).toBe(value);
    }
  });

  it("uses all when the parameter is absent or explicitly all", () => {
    expect(normalizePublicationFilter({})).toBe("all");
    expect(normalizePublicationFilter({ filter: "all" })).toBe("all");
  });

  it("trims a supported filter and ignores blank values", () => {
    expect(normalizePublicationFilter({ filter: "  food  " })).toBe("food");
    expect(normalizePublicationFilter({ filter: "   " })).toBe("all");
    expect(normalizePublicationFilter({ filter: "" })).toBe("all");
  });

  it("ignores an unsupported filter", () => {
    expect(normalizePublicationFilter({ filter: "unknown" })).toBe("all");
  });

  it("ignores repeated filter parameters", () => {
    expect(normalizePublicationFilter({ filter: ["food", "culture"] })).toBe("all");
  });
});
