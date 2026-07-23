import { describe, expect, it } from "vitest";
import { favoriteIdsSchema } from "@/features/save-favorite/model/favorites-request";

describe("favoriteIdsSchema", () => {
  it("accepts canonical PostgreSQL UUID values used by reproducible seeds", () => {
    expect(favoriteIdsSchema.safeParse({
      publicationIds: ["22000000-0000-0000-0000-000000000001"],
      organizationIds: ["21000000-0000-0000-0000-000000000001"]
    }).success).toBe(true);
  });

  it("rejects malformed identifiers", () => {
    expect(favoriteIdsSchema.safeParse({
      publicationIds: ["not-a-uuid"],
      organizationIds: []
    }).success).toBe(false);
  });
});
