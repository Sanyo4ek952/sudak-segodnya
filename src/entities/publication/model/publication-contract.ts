import { z } from "zod";
import { postgresUuidPattern, postgresUuidSchema } from "@/shared/lib/postgres-uuid";

export const publicationTypes = [
  "event",
  "announcement",
  "promo",
  "regular",
  "news"
] as const;

export const publicationIntents = ["draft", "publish", "schedule"] as const;

const optionalDateTime = z
  .string()
  .trim()
  .max(40)
  .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), {
    message: "Укажите корректные дату и время."
  });

const optionalText = (maximum: number) => z.string().trim().max(maximum);

export const publicationScheduleEntrySchema = z
  .object({
    scheduleText: z.string().trim().min(2).max(500),
    weekday: z.number().int().min(1).max(7).nullable(),
    startsAt: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    endsAt: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    sortOrder: z.number().int().min(0).max(100),
    timezone: z.string().trim().min(1).max(80).default("Europe/Moscow")
  })
  .superRefine((entry, context) => {
    if (entry.startsAt && entry.endsAt && entry.endsAt < entry.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Время окончания должно быть не раньше времени начала."
      });
    }
  });

export type PublicationScheduleEntryInput = z.infer<typeof publicationScheduleEntrySchema>;

export function createPublicationInputSchema(now = new Date()) {
  return z
    .object({
      organizationId: postgresUuidSchema,
      publicationId: postgresUuidSchema.or(z.literal("")),
      clientRequestId: z.string().uuid(),
      intent: z.enum(publicationIntents),
      type: z.enum(publicationTypes),
      title: z.string().trim().min(3, "Название должно содержать минимум 3 символа.").max(180),
      description: optionalText(4000),
      categoryId: z.string().regex(postgresUuidPattern, "Выберите категорию ленты."),
      startsAt: optionalDateTime,
      endsAt: optionalDateTime,
      validUntil: optionalDateTime,
      publishAt: optionalDateTime,
      place: optionalText(300),
      priceText: optionalText(120),
      isFree: z.boolean(),
      ageLimit: optionalText(40),
      contactPhone: optionalText(80),
      scheduleEntries: z.array(publicationScheduleEntrySchema).max(20)
    })
    .superRefine((input, context) => {
      if (input.intent === "draft") {
        return;
      }

      if (input.description.length < 10) {
        context.addIssue({
          code: "custom",
          path: ["description"],
          message: "Для публикации заполните описание минимум на 10 символов."
        });
      }

      if (input.type === "event") {
        if (!input.startsAt || !input.endsAt) {
          context.addIssue({
            code: "custom",
            path: ["startsAt"],
            message: "Для мероприятия укажите начало и окончание."
          });
        } else if (Date.parse(input.endsAt) < Date.parse(input.startsAt)) {
          context.addIssue({
            code: "custom",
            path: ["endsAt"],
            message: "Окончание мероприятия должно быть не раньше начала."
          });
        }

        if (!input.place) {
          context.addIssue({
            code: "custom",
            path: ["place"],
            message: "Для мероприятия укажите место."
          });
        }
      }

      if (input.type === "regular") {
        if (!input.place) {
          context.addIssue({
            code: "custom",
            path: ["place"],
            message: "Для регулярного занятия укажите место."
          });
        }

        if (input.scheduleEntries.length === 0) {
          context.addIssue({
            code: "custom",
            path: ["scheduleEntries"],
            message: "Для регулярного занятия заполните расписание."
          });
        } else if (input.scheduleEntries.some((entry) => !entry.startsAt)) {
          context.addIssue({
            code: "custom",
            path: ["scheduleEntries"],
            message: "Для каждого интервала укажите время начала."
          });
        }
      }

      if (input.type !== "event") {
        if (!input.validUntil) {
          context.addIssue({
            code: "custom",
            path: ["validUntil"],
            message: "Укажите срок актуальности публикации."
          });
        } else if (Date.parse(input.validUntil) <= now.getTime()) {
          context.addIssue({
            code: "custom",
            path: ["validUntil"],
            message: "Срок актуальности должен быть в будущем."
          });
        }
      }

      if (
        (input.type === "event" || input.type === "regular") &&
        !input.isFree &&
        !input.priceText
      ) {
        context.addIssue({
          code: "custom",
          path: ["priceText"],
          message: "Укажите цену или отметьте бесплатное участие."
        });
      }

      if (input.intent === "schedule") {
        if (!input.publishAt || Date.parse(input.publishAt) <= now.getTime()) {
          context.addIssue({
            code: "custom",
            path: ["publishAt"],
            message: "Укажите будущее время публикации."
          });
        }
      }
    });
}

export type SavePublicationInput = z.infer<ReturnType<typeof createPublicationInputSchema>>;

export function getFirstPublicationValidationError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Проверьте поля публикации.";
}
