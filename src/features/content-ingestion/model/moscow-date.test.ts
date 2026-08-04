import { describe, expect, it } from "vitest";
import { toMoscowIsoOrOriginal } from "@/features/content-ingestion/model/moscow-date";

describe("Moscow date conversion", () => {
  it("interprets admin datetime-local values in Europe/Moscow (+03:00)", () => {
    expect(toMoscowIsoOrOriginal("2026-08-14T10:15")).toBe("2026-08-14T07:15:00.000Z");
  });

  it("keeps explicit offsets and preserves invalid input for Zod rejection", () => {
    expect(toMoscowIsoOrOriginal("2026-08-14T10:15:00+03:00")).toBe("2026-08-14T07:15:00.000Z");
    expect(toMoscowIsoOrOriginal("unknown")).toBe("unknown");
    expect(toMoscowIsoOrOriginal("  ")).toBeNull();
  });
});
