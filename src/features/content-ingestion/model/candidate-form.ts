import type {
  ContentCandidateAction,
  ContentCandidatePayload,
  PublicationCandidatePayload
} from "@/features/content-ingestion/model/contracts";

export const contentCandidateFormIntents = [
  "save_changes",
  "approve_publish",
  "approve_draft",
  "reject",
  "mark_not_duplicate"
] as const;

export type ContentCandidateFormIntent = (typeof contentCandidateFormIntents)[number];
export type ContentCandidateFieldErrors = Record<string, string>;

export function normalizePublicationCandidateForType(
  payload: PublicationCandidatePayload
): PublicationCandidatePayload {
  if (payload.type === "event") {
    return {
      ...payload,
      validUntil: null,
      scheduleEntries: []
    };
  }

  const withoutEventInterval = {
    ...payload,
    startsAt: null,
    endsAt: null
  };
  if (payload.type === "regular") return withoutEventInterval;

  if (payload.type === "news") {
    return {
      ...withoutEventInterval,
      place: null,
      priceText: null,
      isFree: false,
      ageLimit: null,
      contactPhone: null,
      scheduleEntries: []
    };
  }

  return {
    ...withoutEventInterval,
    place: null,
    ageLimit: null,
    scheduleEntries: []
  };
}

function setError(errors: ContentCandidateFieldErrors, field: string, message: string) {
  if (!errors[field]) errors[field] = message;
}

export function validateCandidateForIntent({
  payload,
  action,
  intent,
  now = new Date()
}: {
  payload: ContentCandidatePayload;
  action: ContentCandidateAction;
  intent: ContentCandidateFormIntent;
  now?: Date;
}) {
  const errors: ContentCandidateFieldErrors = {};
  if (intent === "save_changes" || intent === "mark_not_duplicate" || intent === "reject") {
    return errors;
  }

  if (payload.kind === "organization") {
    if (!payload.description || payload.description.trim().length < 10) {
      setError(errors, "description", "Добавьте описание организации минимум на 10 символов.");
    }
    if (!payload.phone || payload.phone.trim().length < 5) {
      setError(errors, "phone", "Укажите контактный телефон организации.");
    }
    return errors;
  }

  if (!payload.organizationId) {
    setError(
      errors,
      "organizationId",
      "Выберите существующую организацию или создайте новую из связанного кандидата."
    );
  }
  if (
    (action === "update_publication" || action === "cancel_publication")
    && !payload.targetPublicationId
  ) {
    setError(errors, "targetPublicationId", "Выберите публикацию, которую нужно изменить.");
  }
  if (action === "cancel_publication") return errors;
  if (intent === "approve_draft") return errors;

  if (!payload.description || payload.description.trim().length < 10) {
    setError(errors, "description", "Добавьте описание минимум на 10 символов.");
  }

  if (payload.type === "event") {
    if (!payload.startsAt) {
      setError(errors, "startsAt", "Укажите дату и время начала мероприятия.");
    }
    if (!payload.endsAt) {
      setError(errors, "endsAt", "Укажите дату и время окончания мероприятия.");
    }
    if (payload.startsAt && payload.endsAt && Date.parse(payload.endsAt) < Date.parse(payload.startsAt)) {
      setError(errors, "endsAt", "Окончание не может быть раньше начала.");
    }
    if (payload.endsAt && Date.parse(payload.endsAt) <= now.getTime()) {
      setError(errors, "endsAt", "Нельзя опубликовать уже завершившееся мероприятие.");
    }
    if (!payload.place) {
      setError(errors, "place", "Укажите место проведения мероприятия.");
    }
  } else if (!payload.validUntil) {
    setError(errors, "validUntil", "Укажите срок актуальности публикации.");
  } else if (Date.parse(payload.validUntil) <= now.getTime()) {
    setError(errors, "validUntil", "Срок актуальности должен быть в будущем.");
  }

  if (payload.type === "regular") {
    if (!payload.place) {
      setError(errors, "place", "Укажите место проведения регулярного занятия.");
    }
    if (payload.scheduleEntries.length === 0) {
      setError(errors, "scheduleEntries", "Добавьте хотя бы один интервал расписания.");
    } else {
      payload.scheduleEntries.forEach((entry, index) => {
        if (!entry.scheduleText.trim()) {
          setError(errors, `scheduleEntries.${index}.scheduleText`, "Опишите этот интервал расписания.");
        }
        if (!entry.startsAt) {
          setError(errors, `scheduleEntries.${index}.startsAt`, "Укажите время начала.");
        }
        if (entry.startsAt && entry.endsAt && entry.endsAt < entry.startsAt) {
          setError(
            errors,
            `scheduleEntries.${index}.endsAt`,
            "Окончание не может быть раньше начала."
          );
        }
      });
    }
  }

  if (
    (payload.type === "event" || payload.type === "regular")
    && !payload.isFree
    && !payload.priceText
  ) {
    setError(errors, "priceText", "Укажите цену или отметьте бесплатное участие.");
  }

  return errors;
}
