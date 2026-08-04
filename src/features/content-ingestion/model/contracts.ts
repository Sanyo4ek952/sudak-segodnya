import { z } from "zod";
import {
  publicationScheduleEntrySchema,
  publicationTypes
} from "@/entities/publication/model/publication-contract";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

export const contentSourceKinds = ["html", "rss", "manual"] as const;
export const contentSourceTrustLevels = ["official", "partner", "discovery"] as const;
export const contentIngestionTriggers = ["cron", "admin", "agent"] as const;
export const contentCandidateActions = [
  "create_organization",
  "create_publication",
  "update_publication",
  "cancel_publication"
] as const;
export const contentCandidateStatuses = [
  "pending",
  "approved",
  "rejected",
  "duplicate",
  "stale",
  "failed"
] as const;
export const contentCandidateDecisions = [
  "approve_publish",
  "approve_draft",
  "reject",
  "mark_not_duplicate"
] as const;

const optionalNullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().default(null);

const optionalNullableDateTime = z
  .string()
  .trim()
  .max(40)
  .refine(
    (value) => /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value)),
    "Дата и время должны содержать явный часовой пояс."
  )
  .nullable()
  .default(null);

const httpsUrlSchema = z.string().url().max(1000).refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Разрешены только HTTPS-ссылки.");

const contactLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: httpsUrlSchema.max(500)
}).strict();

export const organizationCandidatePayloadSchema = z.object({
  kind: z.literal("organization"),
  name: z.string().trim().min(2).max(160),
  typeSlug: z.string().trim().min(1).max(80),
  description: optionalNullableText(4000),
  address: optionalNullableText(500),
  phone: optionalNullableText(80),
  workingHours: optionalNullableText(1000),
  contactLinks: z.array(contactLinkSchema).max(20).default([])
}).strict();

export const publicationCandidatePayloadSchema = z.object({
  kind: z.literal("publication"),
  organizationId: postgresUuidSchema.nullable().default(null),
  organizationName: z.string().trim().min(2).max(180),
  targetPublicationId: postgresUuidSchema.nullable().default(null),
  type: z.enum(publicationTypes),
  title: z.string().trim().min(3).max(180),
  description: optionalNullableText(4000),
  categorySlug: z.string().trim().min(1).max(80),
  startsAt: optionalNullableDateTime,
  endsAt: optionalNullableDateTime,
  validUntil: optionalNullableDateTime,
  place: optionalNullableText(300),
  priceText: optionalNullableText(120),
  isFree: z.boolean().default(false),
  ageLimit: optionalNullableText(40),
  contactPhone: optionalNullableText(80),
  scheduleEntries: z.array(publicationScheduleEntrySchema).max(20).default([]),
  imageSourceUrl: httpsUrlSchema.nullable().default(null)
}).strict();

export const contentCandidatePayloadSchema = z.discriminatedUnion("kind", [
  organizationCandidatePayloadSchema,
  publicationCandidatePayloadSchema
]);

export const contentCandidateEvidenceSchema = z.object({
  field: z.string().trim().min(1).max(80),
  excerpt: z.string().trim().min(1).max(300),
  sourceUrl: httpsUrlSchema
}).strict();

export const extractedCandidateSchema = z
  .object({
    action: z.enum(contentCandidateActions),
    externalId: optionalNullableText(500),
    payload: contentCandidatePayloadSchema,
    evidence: z.array(contentCandidateEvidenceSchema).min(1).max(40),
    warnings: z.array(z.string().trim().min(1).max(500)).max(30).default([])
  })
  .strict()
  .superRefine((candidate, context) => {
    const isOrganization = candidate.payload.kind === "organization";
    if ((candidate.action === "create_organization") !== isOrganization) {
      context.addIssue({
        code: "custom",
        path: ["action"],
        message: "Действие не соответствует типу payload."
      });
    }

    if (candidate.payload.kind === "publication") {
      for (const field of ["startsAt", "endsAt", "validUntil"] as const) {
        const value = candidate.payload[field];
        if (value && !value.endsWith("+03:00")) {
          context.addIssue({
            code: "custom",
            path: ["payload", field],
            message: "Модель должна возвращать время Europe/Moscow (+03:00)."
          });
        }
      }
    }
  });

export const extractionResultSchema = z.object({
  candidates: z.array(extractedCandidateSchema).max(20)
}).strict();

export const manualIngestionRequestSchema = z
  .object({
    sourceId: postgresUuidSchema.optional(),
    url: z.string().trim().url().max(1000).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.sourceId) === Boolean(value.url)) {
      context.addIssue({
        code: "custom",
        message: "Передайте ровно одно из полей sourceId или url."
      });
    }
  });

export type ContentSourceKind = (typeof contentSourceKinds)[number];
export type ContentSourceTrustLevel = (typeof contentSourceTrustLevels)[number];
export type ContentIngestionTrigger = (typeof contentIngestionTriggers)[number];
export type ContentCandidateAction = (typeof contentCandidateActions)[number];
export type ContentCandidateStatus = (typeof contentCandidateStatuses)[number];
export type ContentCandidateDecision = (typeof contentCandidateDecisions)[number];
export type OrganizationCandidatePayload = z.infer<typeof organizationCandidatePayloadSchema>;
export type PublicationCandidatePayload = z.infer<typeof publicationCandidatePayloadSchema>;
export type ContentCandidatePayload = z.infer<typeof contentCandidatePayloadSchema>;
export type ContentCandidateEvidence = z.infer<typeof contentCandidateEvidenceSchema>;
export type ExtractedCandidate = z.infer<typeof extractedCandidateSchema>;

export function getCandidatePublishWarnings(payload: ContentCandidatePayload, now = new Date()) {
  if (payload.kind === "organization") {
    return [
      !payload.description ? "Добавьте описание организации." : null,
      !payload.phone ? "Добавьте телефон организации." : null,
      !payload.typeSlug ? "Выберите тип организации." : null
    ].filter((warning): warning is string => Boolean(warning));
  }

  const warnings: string[] = [];
  if (!payload.description || payload.description.length < 10) {
    warnings.push("Добавьте описание минимум на 10 символов.");
  }
  if (!payload.organizationId) {
    warnings.push("Свяжите материал с активной организацией.");
  }
  if (payload.type === "event") {
    if (!payload.startsAt || !payload.endsAt) {
      warnings.push("Для мероприятия нужны начало и окончание.");
    } else if (Date.parse(payload.endsAt) < Date.parse(payload.startsAt)) {
      warnings.push("Окончание не может быть раньше начала.");
    } else if (Date.parse(payload.endsAt) <= now.getTime()) {
      warnings.push("Мероприятие уже завершилось.");
    }
    if (!payload.place) warnings.push("Укажите место мероприятия.");
  } else {
    if (!payload.validUntil) {
      warnings.push("Укажите срок актуальности.");
    } else if (Date.parse(payload.validUntil) <= now.getTime()) {
      warnings.push("Срок актуальности уже истёк.");
    }
  }
  if (payload.type === "regular") {
    if (!payload.place) warnings.push("Укажите место регулярного занятия.");
    if (payload.scheduleEntries.length === 0) warnings.push("Добавьте расписание.");
    if (payload.scheduleEntries.some((entry) => !entry.startsAt)) {
      warnings.push("У каждого интервала должно быть время начала.");
    }
  }
  if (
    (payload.type === "event" || payload.type === "regular") &&
    !payload.isFree &&
    !payload.priceText
  ) {
    warnings.push("Укажите цену или отметьте бесплатное участие.");
  }
  return warnings;
}
