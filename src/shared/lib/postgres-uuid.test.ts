import { describe, expect, it } from "vitest";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

describe("postgresUuidSchema", () => {
  it("accepts canonical UUID values supported by PostgreSQL", () => {
    expect(postgresUuidSchema.safeParse("21000000-0000-0000-0000-000000000001").success).toBe(true);
    expect(postgresUuidSchema.safeParse(crypto.randomUUID()).success).toBe(true);
  });

  it("rejects malformed and non-canonical values", () => {
    expect(postgresUuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(postgresUuidSchema.safeParse("21000000000000000000000000000001").success).toBe(false);
  });
});
