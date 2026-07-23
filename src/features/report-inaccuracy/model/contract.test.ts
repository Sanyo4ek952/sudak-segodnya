import { describe, expect, it } from "vitest";
import {
  createInaccuracyReportPayload,
  inaccuracyReportReasons,
  inaccuracyReportSchema
} from "./contract";

const publicationId = "12000000-0000-4000-8000-000000000001";
const reporterFingerprint = "contract-test-fingerprint";

describe("inaccuracy report contract", () => {
  it("matches all documented report reasons", () => {
    expect(inaccuracyReportReasons).toEqual([
      "wrong_datetime",
      "wrong_price",
      "cancelled",
      "wrong_address",
      "outdated",
      "other"
    ]);
  });

  describe.each(inaccuracyReportReasons)("report reason %s", (reason) => {
    it("passes validation and creates the matching RPC payload", () => {
      const parsed = inaccuracyReportSchema.safeParse({
        publicationId,
        reason,
        comment: "  Проверка причины  "
      });

      if (!parsed.success) {
        throw new Error(parsed.error.message);
      }

      expect(createInaccuracyReportPayload(parsed.data, reporterFingerprint)).toEqual({
        publication_id: publicationId,
        reason,
        comment: "Проверка причины",
        reporter_fingerprint: reporterFingerprint
      });
    });
  });

  it("rejects the legacy wrong_time value", () => {
    expect(
      inaccuracyReportSchema.safeParse({
        publicationId,
        reason: "wrong_time",
        comment: "Проверка legacy-значения"
      }).success
    ).toBe(false);
  });
});
