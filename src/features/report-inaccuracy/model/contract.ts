import { z } from "zod";

export const inaccuracyReportReasons = [
  "wrong_datetime",
  "wrong_price",
  "cancelled",
  "wrong_address",
  "outdated",
  "other"
] as const;

export type InaccuracyReportReason = (typeof inaccuracyReportReasons)[number];

export const inaccuracyReportSchema = z.object({
  publicationId: z.string().uuid(),
  reason: z.enum(inaccuracyReportReasons),
  comment: z.string().trim().max(1000).optional()
});

export type InaccuracyReportInput = z.infer<typeof inaccuracyReportSchema>;

export type CreateInaccuracyReportPayload = {
  publication_id: string;
  reason: InaccuracyReportReason;
  comment: string;
  reporter_fingerprint: string;
};

export function createInaccuracyReportPayload(
  input: InaccuracyReportInput,
  reporterFingerprint: string
): CreateInaccuracyReportPayload {
  return {
    publication_id: input.publicationId,
    reason: input.reason,
    comment: input.comment ?? "",
    reporter_fingerprint: reporterFingerprint
  };
}
