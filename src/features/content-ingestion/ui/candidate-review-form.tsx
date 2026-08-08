"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type {
  ContentCandidateAction,
  ContentCandidatePayload,
  OrganizationCandidatePayload,
  PublicationCandidatePayload
} from "@/features/content-ingestion/model/contracts";
import { initialContentIngestionActionState } from "@/features/content-ingestion/model/types";
import { reviewContentCandidateAction } from "@/features/content-ingestion/model/actions";
import { importedNewsValidUntil } from "@/features/content-ingestion/model/candidate-rules";
import { ContentIngestionActionMessage } from "@/features/content-ingestion/ui/content-ingestion-action-message";
import type { PublicationScheduleEntryInput } from "@/entities/publication/model/publication-contract";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

type Option = { id: string; name: string; slug: string };
type OrganizationOption = Option & {
  address: string | null;
  phone: string | null;
};
type PublicationOption = {
  id: string;
  organization_id: string;
  title: string;
  starts_at: string | null;
  valid_until: string | null;
  status: string;
};
type DependencyOrganization = {
  id: string;
  status: string;
  updatedAt: string;
  payload: OrganizationCandidatePayload;
};

const weekdayOptions = [
  { value: "", label: "Каждый день" },
  { value: "1", label: "Понедельник" },
  { value: "2", label: "Вторник" },
  { value: "3", label: "Среда" },
  { value: "4", label: "Четверг" },
  { value: "5", label: "Пятница" },
  { value: "6", label: "Суббота" },
  { value: "7", label: "Воскресенье" }
];

function fieldDescriptionId(id: string, error?: string, hasHint = false) {
  if (error) return `${id}-error`;
  return hasHint ? `${id}-hint` : undefined;
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return formatter.format(date).replace(" ", "T");
}

function newsValidityFromLocalSource(value: string) {
  if (!value) return "";
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return toLocalDateTime(importedNewsValidUntil(`${withSeconds}+03:00`));
}

function createEmptyScheduleEntry(sortOrder: number): PublicationScheduleEntryInput {
  return {
    scheduleText: "",
    weekday: null,
    startsAt: null,
    endsAt: null,
    sortOrder,
    timezone: "Europe/Moscow"
  };
}

function OrganizationCandidateFields({
  value,
  onChange,
  organizationTypes,
  editable,
  idPrefix,
  namePrefix = "",
  errors
}: {
  value: OrganizationCandidatePayload;
  onChange: (value: OrganizationCandidatePayload) => void;
  organizationTypes: Option[];
  editable: boolean;
  idPrefix: string;
  namePrefix?: string;
  errors: Record<string, string>;
}) {
  const fieldName = (name: string) => namePrefix
    ? `${namePrefix}${name.charAt(0).toUpperCase()}${name.slice(1)}`
    : name;
  const fieldError = (name: string) => errors[fieldName(name)];
  const linksError = Object.entries(errors).find(([key]) => (
    key === fieldName("contactLinks") || key.startsWith(`${fieldName("contactLinks")}.`)
  ))?.[1];

  return (
    <>
      <FormField id={`${idPrefix}-name`} label="Название" error={fieldError("name")}>
        <Input
          id={`${idPrefix}-name`}
          name={fieldName("name")}
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          maxLength={160}
          aria-invalid={Boolean(fieldError("name"))}
          aria-describedby={fieldDescriptionId(`${idPrefix}-name`, fieldError("name"))}
          disabled={!editable}
          required
        />
      </FormField>
      <FormField id={`${idPrefix}-type`} label="Тип организации" error={fieldError("typeSlug")}>
        <Select
          id={`${idPrefix}-type`}
          name={fieldName("typeSlug")}
          value={value.typeSlug}
          onChange={(event) => onChange({ ...value, typeSlug: event.target.value })}
          aria-invalid={Boolean(fieldError("typeSlug"))}
          aria-describedby={fieldDescriptionId(`${idPrefix}-type`, fieldError("typeSlug"))}
          disabled={!editable}
          required
        >
          {organizationTypes.map((option) => (
            <option key={option.id} value={option.slug}>{option.name}</option>
          ))}
        </Select>
      </FormField>
      <FormField
        id={`${idPrefix}-description`}
        label="Описание"
        hint="Для активной организации нужно минимум 10 символов."
        error={fieldError("description")}
      >
        <Textarea
          id={`${idPrefix}-description`}
          name={fieldName("description")}
          value={value.description ?? ""}
          onChange={(event) => onChange({ ...value, description: event.target.value || null })}
          maxLength={4000}
          aria-invalid={Boolean(fieldError("description"))}
          aria-describedby={fieldDescriptionId(`${idPrefix}-description`, fieldError("description"), true)}
          disabled={!editable}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${idPrefix}-address`} label="Адрес" error={fieldError("address")}>
          <Input
            id={`${idPrefix}-address`}
            name={fieldName("address")}
            value={value.address ?? ""}
            onChange={(event) => onChange({ ...value, address: event.target.value || null })}
            maxLength={500}
            aria-invalid={Boolean(fieldError("address"))}
            aria-describedby={fieldDescriptionId(`${idPrefix}-address`, fieldError("address"))}
            disabled={!editable}
          />
        </FormField>
        <FormField
          id={`${idPrefix}-phone`}
          label="Телефон"
          hint="Обязателен для активной организации."
          error={fieldError("phone")}
        >
          <Input
            id={`${idPrefix}-phone`}
            name={fieldName("phone")}
            type="tel"
            value={value.phone ?? ""}
            onChange={(event) => onChange({ ...value, phone: event.target.value || null })}
            maxLength={80}
            aria-invalid={Boolean(fieldError("phone"))}
            aria-describedby={fieldDescriptionId(`${idPrefix}-phone`, fieldError("phone"), true)}
            disabled={!editable}
          />
        </FormField>
      </div>
      <FormField id={`${idPrefix}-working-hours`} label="График работы" error={fieldError("workingHours")}>
        <Textarea
          id={`${idPrefix}-working-hours`}
          name={fieldName("workingHours")}
          value={value.workingHours ?? ""}
          onChange={(event) => onChange({ ...value, workingHours: event.target.value || null })}
          maxLength={1000}
          aria-invalid={Boolean(fieldError("workingHours"))}
          aria-describedby={fieldDescriptionId(`${idPrefix}-working-hours`, fieldError("workingHours"))}
          disabled={!editable}
        />
      </FormField>

      <div
        className="space-y-3 rounded-lg border border-border bg-surface-muted p-4"
        tabIndex={linksError ? -1 : undefined}
        aria-invalid={Boolean(linksError)}
        aria-describedby={linksError ? `${idPrefix}-links-error` : undefined}
      >
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">Ссылки организации</h3>
          <p className="text-sm leading-6 text-foreground-muted">
            Проверьте подпись и публичный HTTPS-адрес каждой найденной ссылки.
          </p>
        </div>
        <input type="hidden" name={fieldName("contactLinks")} value={JSON.stringify(value.contactLinks)} />
        {value.contactLinks.map((link, index) => (
          <div key={`${index}-${link.href}`} className="grid gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-[1fr_2fr_auto]">
            <FormField id={`${idPrefix}-link-label-${index}`} label="Подпись">
              <Input
                id={`${idPrefix}-link-label-${index}`}
                value={link.label}
                onChange={(event) => onChange({
                  ...value,
                  contactLinks: value.contactLinks.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, label: event.target.value } : item
                  ))
                })}
                maxLength={80}
                disabled={!editable}
              />
            </FormField>
            <FormField id={`${idPrefix}-link-url-${index}`} label="URL">
              <Input
                id={`${idPrefix}-link-url-${index}`}
                type="url"
                value={link.href}
                onChange={(event) => onChange({
                  ...value,
                  contactLinks: value.contactLinks.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, href: event.target.value } : item
                  ))
                })}
                maxLength={500}
                disabled={!editable}
              />
            </FormField>
            {editable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-end"
                onClick={() => onChange({
                  ...value,
                  contactLinks: value.contactLinks.filter((_, itemIndex) => itemIndex !== index)
                })}
              >
                Удалить
              </Button>
            ) : null}
          </div>
        ))}
        {linksError ? <p id={`${idPrefix}-links-error`} className="text-sm text-error">{linksError}</p> : null}
        {editable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({
              ...value,
              contactLinks: [...value.contactLinks, { label: "Сайт", href: "" }]
            })}
          >
            Добавить ссылку
          </Button>
        ) : null}
      </div>

      <FormField
        id={`${idPrefix}-image-source`}
        label="URL изображения источника"
        hint="После одобрения изображение будет безопасно скопировано в Storage."
        error={fieldError("imageSourceUrl")}
      >
        <Input
          id={`${idPrefix}-image-source`}
          name={fieldName("imageSourceUrl")}
          type="url"
          value={value.imageSourceUrl ?? ""}
          onChange={(event) => onChange({ ...value, imageSourceUrl: event.target.value || null })}
          maxLength={1000}
          aria-invalid={Boolean(fieldError("imageSourceUrl"))}
          aria-describedby={fieldDescriptionId(`${idPrefix}-image-source`, fieldError("imageSourceUrl"), true)}
          disabled={!editable}
        />
      </FormField>
    </>
  );
}

function ScheduleEditor({
  entries,
  onChange,
  errors,
  editable
}: {
  entries: PublicationScheduleEntryInput[];
  onChange: (entries: PublicationScheduleEntryInput[]) => void;
  errors: Record<string, string>;
  editable: boolean;
}) {
  const updateEntry = (index: number, patch: Partial<PublicationScheduleEntryInput>) => {
    onChange(entries.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...patch } : entry
    )));
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-muted p-4">
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">Расписание</h3>
        <p className="text-sm leading-6 text-foreground-muted">
          Добавьте отдельный интервал для каждого дня. Часовой пояс — Судак, Europe/Moscow.
        </p>
      </div>
      {entries.map((entry, index) => {
        const textError = errors[`scheduleEntries.${index}.scheduleText`];
        const startError = errors[`scheduleEntries.${index}.startsAt`];
        const endError = errors[`scheduleEntries.${index}.endsAt`];
        return (
          <div key={index} className="space-y-3 rounded-md border border-border bg-surface p-3">
            <FormField id={`schedule-text-${index}`} label="Как показать расписание" error={textError}>
              <Input
                id={`schedule-text-${index}`}
                value={entry.scheduleText}
                onChange={(event) => updateEntry(index, { scheduleText: event.target.value })}
                placeholder="Например: по понедельникам и средам"
                maxLength={500}
                aria-invalid={Boolean(textError)}
                aria-describedby={fieldDescriptionId(`schedule-text-${index}`, textError)}
                disabled={!editable}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField id={`schedule-weekday-${index}`} label="День недели">
                <Select
                  id={`schedule-weekday-${index}`}
                  value={entry.weekday?.toString() ?? ""}
                  onChange={(event) => updateEntry(index, {
                    weekday: event.target.value ? Number(event.target.value) : null
                  })}
                  disabled={!editable}
                >
                  {weekdayOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField id={`schedule-start-${index}`} label="Начало" error={startError}>
                <Input
                  id={`schedule-start-${index}`}
                  type="time"
                  value={entry.startsAt ?? ""}
                  onChange={(event) => updateEntry(index, { startsAt: event.target.value || null })}
                  aria-invalid={Boolean(startError)}
                  aria-describedby={fieldDescriptionId(`schedule-start-${index}`, startError)}
                  disabled={!editable}
                />
              </FormField>
              <FormField id={`schedule-end-${index}`} label="Окончание" error={endError}>
                <Input
                  id={`schedule-end-${index}`}
                  type="time"
                  value={entry.endsAt ?? ""}
                  onChange={(event) => updateEntry(index, { endsAt: event.target.value || null })}
                  aria-invalid={Boolean(endError)}
                  aria-describedby={fieldDescriptionId(`schedule-end-${index}`, endError)}
                  disabled={!editable}
                />
              </FormField>
            </div>
            {editable && entries.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(entries.filter((_, itemIndex) => itemIndex !== index))}
              >
                Удалить интервал
              </Button>
            ) : null}
          </div>
        );
      })}
      {errors.scheduleEntries ? <p id="candidate-schedule-error" className="text-sm text-error">{errors.scheduleEntries}</p> : null}
      {editable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...entries, createEmptyScheduleEntry(entries.length)])}
          aria-invalid={Boolean(errors.scheduleEntries)}
          aria-describedby={errors.scheduleEntries ? "candidate-schedule-error" : undefined}
        >
          Добавить интервал
        </Button>
      ) : null}
    </div>
  );
}

export function CandidateReviewForm({
  candidateId,
  candidateUpdatedAt,
  action: candidateAction,
  status,
  payload,
  organizations,
  categories,
  organizationTypes,
  publications,
  dependencyOrganization,
  targetOrganizationId,
  sourceOrganizationId
}: {
  candidateId: string;
  candidateUpdatedAt: string;
  action: ContentCandidateAction;
  status: string;
  payload: ContentCandidatePayload;
  organizations: OrganizationOption[];
  categories: Option[];
  organizationTypes: Option[];
  publications: PublicationOption[];
  dependencyOrganization: DependencyOrganization | null;
  targetOrganizationId: string | null;
  sourceOrganizationId: string | null;
}) {
  const [state, formAction] = useActionState(
    reviewContentCandidateAction,
    initialContentIngestionActionState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const editable = status === "pending" || status === "duplicate";
  const dependencyEditable = dependencyOrganization
    ? dependencyOrganization.status === "pending" || dependencyOrganization.status === "duplicate"
    : false;
  const initialOrganizationId = payload.kind === "publication"
    ? payload.organizationId ?? targetOrganizationId ?? sourceOrganizationId ?? ""
    : "";
  const initialOrganization = organizations.find((item) => item.id === initialOrganizationId) ?? null;
  const initialOrganizationChoice = payload.kind === "publication"
    ? initialOrganizationId || (
      candidateAction === "create_publication" && dependencyEditable ? "create_dependency" : ""
    )
    : "";

  const [dirty, setDirty] = useState(false);
  const [organizationChoice, setOrganizationChoice] = useState(initialOrganizationChoice);
  const [organizationDraft, setOrganizationDraft] = useState<OrganizationCandidatePayload | null>(
    payload.kind === "organization" ? payload : null
  );
  const [dependencyDraft, setDependencyDraft] = useState<OrganizationCandidatePayload | null>(
    dependencyOrganization?.payload ?? null
  );
  const publicationPayload = payload.kind === "publication" ? payload : null;
  const [publicationType, setPublicationType] = useState<PublicationCandidatePayload["type"]>(
    publicationPayload?.type ?? "event"
  );
  const [organizationName, setOrganizationName] = useState(
    initialOrganization?.name ?? publicationPayload?.organizationName ?? ""
  );
  const [targetPublicationId, setTargetPublicationId] = useState(
    publicationPayload?.targetPublicationId ?? ""
  );
  const [title, setTitle] = useState(publicationPayload?.title ?? "");
  const [description, setDescription] = useState(publicationPayload?.description ?? "");
  const [categorySlug, setCategorySlug] = useState(
    publicationPayload?.categorySlug ?? categories[0]?.slug ?? ""
  );
  const [startsAt, setStartsAt] = useState(toLocalDateTime(publicationPayload?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalDateTime(publicationPayload?.endsAt ?? null));
  const [validUntil, setValidUntil] = useState(toLocalDateTime(publicationPayload?.validUntil ?? null));
  const [sourcePublishedAt, setSourcePublishedAt] = useState(
    toLocalDateTime(publicationPayload?.sourcePublishedAt ?? null)
  );
  const [place, setPlace] = useState(
    publicationPayload?.place
      ?? ((publicationType === "event" || publicationType === "regular") ? initialOrganization?.address ?? "" : "")
  );
  const [priceText, setPriceText] = useState(publicationPayload?.priceText ?? "");
  const [isFree, setIsFree] = useState(publicationPayload?.isFree ?? false);
  const [ageLimit, setAgeLimit] = useState(publicationPayload?.ageLimit ?? "");
  const [contactPhone, setContactPhone] = useState(
    publicationPayload?.contactPhone ?? (publicationType !== "news" ? initialOrganization?.phone ?? "" : "")
  );
  const [imageSourceUrl, setImageSourceUrl] = useState(publicationPayload?.imageSourceUrl ?? "");
  const [reviewComment, setReviewComment] = useState("");
  const [scheduleEntries, setScheduleEntries] = useState<PublicationScheduleEntryInput[]>(
    publicationPayload?.scheduleEntries.length
      ? publicationPayload.scheduleEntries
      : [createEmptyScheduleEntry(0)]
  );
  const errors = state.fieldErrors ?? {};

  const scheduleJson = useMemo(() => JSON.stringify(
    scheduleEntries
      .filter((entry) => Boolean(entry.scheduleText.trim() || entry.startsAt || entry.endsAt))
      .map((entry, index) => ({ ...entry, sortOrder: index }))
  ), [scheduleEntries]);
  const visiblePublications = useMemo(() => {
    const eligible = candidateAction === "cancel_publication"
      ? publications.filter((publication) => publication.status === "published")
      : publications;
    if (!organizationChoice || organizationChoice === "create_dependency") return eligible;
    return eligible.filter((publication) => publication.organization_id === organizationChoice);
  }, [candidateAction, organizationChoice, publications]);

  useEffect(() => {
    if (!dirty) return;
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnAboutUnsavedChanges);
    return () => window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
  }, [dirty]);

  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
    firstInvalid?.focus();
  }, [state]);

  function selectOrganization(value: string) {
    const previousOrganization = organizations.find(
      (organization) => organization.id === organizationChoice
    );
    const previousDefaults = organizationChoice === "create_dependency"
      ? dependencyDraft
        ? { address: dependencyDraft.address, phone: dependencyDraft.phone }
        : null
      : previousOrganization;
    const placeUsesPreviousDefault = Boolean(
      previousDefaults?.address
      && place.trim() === previousDefaults.address.trim()
    );
    const phoneUsesPreviousDefault = Boolean(
      previousDefaults?.phone
      && contactPhone.trim() === previousDefaults.phone.trim()
    );
    setOrganizationChoice(value);
    setDirty(true);
    if (value === "create_dependency") {
      setOrganizationName(dependencyDraft?.name ?? organizationName);
      if (
        (publicationType === "event" || publicationType === "regular")
        && (!place.trim() || placeUsesPreviousDefault)
      ) {
        setPlace(dependencyDraft?.address ?? "");
      }
      if (publicationType !== "news" && (!contactPhone.trim() || phoneUsesPreviousDefault)) {
        setContactPhone(dependencyDraft?.phone ?? "");
      }
      return;
    }
    const selected = organizations.find((organization) => organization.id === value);
    if (!selected) return;
    setOrganizationName(selected.name);
    if (
      (publicationType === "event" || publicationType === "regular")
      && (!place.trim() || placeUsesPreviousDefault)
    ) {
      setPlace(selected.address ?? "");
    }
    if (publicationType !== "news" && (!contactPhone.trim() || phoneUsesPreviousDefault)) {
      setContactPhone(selected.phone ?? "");
    }
  }

  function selectTargetPublication(value: string) {
    setTargetPublicationId(value);
    setDirty(true);
    const selected = publications.find((publication) => publication.id === value);
    if (selected && selected.organization_id !== organizationChoice) {
      selectOrganization(selected.organization_id);
    }
  }

  function changePublicationType(value: PublicationCandidatePayload["type"]) {
    setPublicationType(value);
    const selectedOrganization = organizationChoice === "create_dependency"
      ? dependencyDraft
      : organizations.find((organization) => organization.id === organizationChoice) ?? null;
    if ((value === "event" || value === "regular") && !place.trim()) {
      setPlace(selectedOrganization?.address ?? "");
    }
    if (value !== "news" && !contactPhone.trim()) {
      setContactPhone(selectedOrganization?.phone ?? "");
    }
    if (value === "news" && sourcePublishedAt) {
      setValidUntil(newsValidityFromLocalSource(sourcePublishedAt));
    }
  }

  function changeSourcePublishedAt(value: string) {
    setSourcePublishedAt(value);
    setValidUntil(newsValidityFromLocalSource(value));
  }

  const usesEventDates = publicationType === "event";
  const usesValidity = publicationType !== "event";
  const usesSchedule = publicationType === "regular";
  const usesPlace = publicationType === "event" || publicationType === "regular";
  const usesPrice = publicationType === "event" || publicationType === "regular" || publicationType === "promo";
  const usesAge = publicationType === "event" || publicationType === "regular";
  const usesPhone = publicationType !== "news";
  const isCancellation = candidateAction === "cancel_publication";

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-6"
      noValidate
      onChange={() => setDirty(true)}
    >
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="payloadKind" value={payload.kind} />
      <input type="hidden" name="expectedUpdatedAt" value={state.updatedAt ?? candidateUpdatedAt} />
      <input type="hidden" name="dependencyCandidateId" value={dependencyEditable ? dependencyOrganization?.id ?? "" : ""} />
      <input
        type="hidden"
        name="dependencyExpectedUpdatedAt"
        value={state.dependencyUpdatedAt ?? dependencyOrganization?.updatedAt ?? ""}
      />

      {organizationDraft ? (
        <section className="space-y-4" aria-labelledby="candidate-organization-heading">
          <div className="space-y-1">
            <h2 id="candidate-organization-heading" className="text-xl font-semibold">Данные организации</h2>
            <p className="text-sm leading-6 text-foreground-muted">
              Найденные значения можно исправить и сохранить до окончательного решения.
            </p>
          </div>
          <OrganizationCandidateFields
            value={organizationDraft}
            onChange={(value) => { setOrganizationDraft(value); setDirty(true); }}
            organizationTypes={organizationTypes}
            editable={editable}
            idPrefix="candidate"
            errors={errors}
          />
        </section>
      ) : publicationPayload ? (
        <>
          <section className="space-y-4" aria-labelledby="candidate-association-heading">
            <div className="space-y-1">
              <h2 id="candidate-association-heading" className="text-xl font-semibold">Связь с организацией</h2>
              <p className="text-sm leading-6 text-foreground-muted">
                Сначала используется организация источника, затем точное совпадение названия. Ручной выбор запоминается в кандидате.
              </p>
            </div>
            <FormField
              id="candidate-organization"
              label="Организация"
              hint="Публичная публикация не может существовать без организации."
              error={errors.organizationId}
            >
              <Select
                id="candidate-organization"
                name="organizationId"
                value={organizationChoice}
                onChange={(event) => selectOrganization(event.target.value)}
                aria-invalid={Boolean(errors.organizationId)}
                aria-describedby={errors.organizationId ? "candidate-organization-error" : "candidate-organization-hint"}
                disabled={!editable}
              >
                <option value="">Не сопоставлена — публикация останется в очереди</option>
                {candidateAction === "create_publication" && dependencyEditable && dependencyDraft ? (
                  <option value="create_dependency">Создать новую «{dependencyDraft.name}»</option>
                ) : null}
                {organizations.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}{option.id === sourceOrganizationId ? " · привязана к источнику" : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            <input type="hidden" name="organizationName" value={organizationName} />

            {organizationChoice === "create_dependency" && dependencyDraft ? (
              <div className="space-y-4 rounded-lg border border-border bg-surface-muted p-4">
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">Новая организация</h3>
                  <p className="text-sm leading-6 text-foreground-muted">
                    Организация и публикация создадутся одной транзакцией. При ошибке не сохранится ни одна из них.
                  </p>
                </div>
                <OrganizationCandidateFields
                  value={dependencyDraft}
                  onChange={(value) => { setDependencyDraft(value); setDirty(true); }}
                  organizationTypes={organizationTypes}
                  editable={editable}
                  idPrefix="dependency"
                  namePrefix="dependency"
                  errors={errors}
                />
              </div>
            ) : null}

            {candidateAction === "update_publication" || candidateAction === "cancel_publication" ? (
              <FormField
                id="candidate-target-publication"
                label={candidateAction === "cancel_publication" ? "Публикация для отмены" : "Публикация для обновления"}
                hint="После выбора публикации её организация подставится автоматически."
                error={errors.targetPublicationId}
              >
                <Select
                  id="candidate-target-publication"
                  name="targetPublicationId"
                  value={targetPublicationId}
                  onChange={(event) => selectTargetPublication(event.target.value)}
                  aria-invalid={Boolean(errors.targetPublicationId)}
                  aria-describedby={fieldDescriptionId("candidate-target-publication", errors.targetPublicationId, true)}
                  disabled={!editable}
                >
                  <option value="">Выберите существующую публикацию</option>
                  {visiblePublications.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title} · {option.starts_at ?? option.valid_until ?? "без даты"}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : (
              <input type="hidden" name="targetPublicationId" value={targetPublicationId} />
            )}
          </section>

          <section className="space-y-4" aria-labelledby="candidate-content-heading">
            <div className="space-y-1">
              <h2 id="candidate-content-heading" className="text-xl font-semibold">
                {isCancellation ? "Данные из источника" : "Содержание"}
              </h2>
              <p className="text-sm leading-6 text-foreground-muted">
                {isCancellation
                  ? "При подтверждении отмены содержание публикации не перезаписывается."
                  : "Показываются только поля, которые используются выбранным типом публикации."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="candidate-publication-type" label="Тип публикации" error={errors.publicationType}>
                <Select
                  id="candidate-publication-type"
                  name="publicationType"
                  value={publicationType}
                  onChange={(event) => changePublicationType(
                    event.target.value as PublicationCandidatePayload["type"]
                  )}
                  aria-invalid={Boolean(errors.publicationType)}
                  aria-describedby={fieldDescriptionId("candidate-publication-type", errors.publicationType)}
                  disabled={!editable || isCancellation}
                >
                  <option value="event">Мероприятие</option>
                  <option value="announcement">Объявление</option>
                  <option value="promo">Акция</option>
                  <option value="regular">Регулярное занятие</option>
                  <option value="news">Новость организации</option>
                </Select>
              </FormField>
              <FormField id="candidate-category" label="Категория ленты" error={errors.categorySlug}>
                <Select
                  id="candidate-category"
                  name="categorySlug"
                  value={categorySlug}
                  onChange={(event) => setCategorySlug(event.target.value)}
                  aria-invalid={Boolean(errors.categorySlug)}
                  aria-describedby={fieldDescriptionId("candidate-category", errors.categorySlug)}
                  disabled={!editable || isCancellation}
                >
                  {categories.map((option) => (
                    <option key={option.id} value={option.slug}>{option.name}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField id="candidate-title" label="Название" error={errors.title}>
              <Input
                id="candidate-title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={180}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={fieldDescriptionId("candidate-title", errors.title)}
                disabled={!editable || isCancellation}
                required
              />
            </FormField>
            <FormField id="candidate-publication-description" label="Описание" error={errors.description}>
              <Textarea
                id="candidate-publication-description"
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={fieldDescriptionId("candidate-publication-description", errors.description)}
                disabled={!editable || isCancellation}
              />
            </FormField>
          </section>

          {!isCancellation ? (
            <>
              <section className="space-y-4" aria-labelledby="candidate-time-heading">
                <div className="space-y-1">
                  <h2 id="candidate-time-heading" className="text-xl font-semibold">Дата, время и актуальность</h2>
                  <p className="text-sm leading-6 text-foreground-muted">
                    Время интерпретируется в часовом поясе Судака — Europe/Moscow (UTC+3).
                  </p>
                </div>
                {usesEventDates ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField id="candidate-starts-at" label="Начало" error={errors.startsAt}>
                      <Input
                        id="candidate-starts-at"
                        type="datetime-local"
                        name="startsAt"
                        value={startsAt}
                        onChange={(event) => setStartsAt(event.target.value)}
                        step="60"
                        aria-invalid={Boolean(errors.startsAt)}
                        aria-describedby={fieldDescriptionId("candidate-starts-at", errors.startsAt)}
                        disabled={!editable}
                      />
                    </FormField>
                    <FormField id="candidate-ends-at" label="Окончание" error={errors.endsAt}>
                      <Input
                        id="candidate-ends-at"
                        type="datetime-local"
                        name="endsAt"
                        value={endsAt}
                        onChange={(event) => setEndsAt(event.target.value)}
                        step="60"
                        aria-invalid={Boolean(errors.endsAt)}
                        aria-describedby={fieldDescriptionId("candidate-ends-at", errors.endsAt)}
                        disabled={!editable}
                      />
                    </FormField>
                  </div>
                ) : null}
                {publicationType === "news" ? (
                  <FormField
                    id="candidate-source-published-at"
                    label="Дата публикации в источнике"
                    hint="Нужна для подтверждения актуальности. Срок новости рассчитывается автоматически на 7 дней."
                    error={errors.sourcePublishedAt}
                  >
                    <Input
                      id="candidate-source-published-at"
                      type="datetime-local"
                      name="sourcePublishedAt"
                      value={sourcePublishedAt}
                      onChange={(event) => changeSourcePublishedAt(event.target.value)}
                      step="60"
                      aria-invalid={Boolean(errors.sourcePublishedAt)}
                      aria-describedby={fieldDescriptionId(
                        "candidate-source-published-at",
                        errors.sourcePublishedAt,
                        true
                      )}
                      disabled={!editable}
                    />
                  </FormField>
                ) : (
                  <input type="hidden" name="sourcePublishedAt" value={sourcePublishedAt} />
                )}
                {usesValidity ? (
                  <FormField
                    id="candidate-valid-until"
                    label="Актуально до"
                    hint={publicationType === "news" ? "Рассчитывается автоматически: 7 дней от даты публикации в источнике." : undefined}
                    error={errors.validUntil}
                  >
                    <Input
                      id="candidate-valid-until"
                      type="datetime-local"
                      name="validUntil"
                      value={validUntil}
                      onChange={(event) => setValidUntil(event.target.value)}
                      readOnly={publicationType === "news"}
                      step="60"
                      aria-invalid={Boolean(errors.validUntil)}
                      aria-describedby={fieldDescriptionId("candidate-valid-until", errors.validUntil, publicationType === "news")}
                      disabled={!editable}
                    />
                  </FormField>
                ) : null}
                {!usesEventDates ? <input type="hidden" name="startsAt" value="" /> : null}
                {!usesEventDates ? <input type="hidden" name="endsAt" value="" /> : null}
                {!usesValidity ? <input type="hidden" name="validUntil" value="" /> : null}
                {usesSchedule ? (
                  <ScheduleEditor
                    entries={scheduleEntries}
                    onChange={(entries) => { setScheduleEntries(entries); setDirty(true); }}
                    errors={errors}
                    editable={editable}
                  />
                ) : null}
                <input type="hidden" name="scheduleEntries" value={usesSchedule ? scheduleJson : "[]"} />
              </section>

              {(usesPlace || usesPrice || usesAge || usesPhone) ? (
                <section className="space-y-4" aria-labelledby="candidate-details-heading">
                  <div className="space-y-1">
                    <h2 id="candidate-details-heading" className="text-xl font-semibold">Место, условия и контакты</h2>
                    <p className="text-sm leading-6 text-foreground-muted">
                      Пустые место и телефон автоматически заполняются данными выбранной организации, когда это уместно.
                    </p>
                  </div>
                  {usesPlace ? (
                    <FormField id="candidate-place" label="Место" error={errors.place}>
                      <Input
                        id="candidate-place"
                        name="place"
                        value={place}
                        onChange={(event) => setPlace(event.target.value)}
                        maxLength={300}
                        aria-invalid={Boolean(errors.place)}
                        aria-describedby={fieldDescriptionId("candidate-place", errors.place)}
                        disabled={!editable}
                      />
                    </FormField>
                  ) : <input type="hidden" name="place" value="" />}
                  {usesPrice ? (
                    <div className="space-y-3">
                      <FormField id="candidate-price" label="Цена или условия" error={errors.priceText}>
                        <Input
                          id="candidate-price"
                          name="priceText"
                          value={priceText}
                          onChange={(event) => setPriceText(event.target.value)}
                          maxLength={120}
                          aria-invalid={Boolean(errors.priceText)}
                          aria-describedby={fieldDescriptionId("candidate-price", errors.priceText)}
                          disabled={!editable || isFree}
                        />
                      </FormField>
                      {(publicationType === "event" || publicationType === "regular") ? (
                        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                          <input
                            type="checkbox"
                            name="isFree"
                            checked={isFree}
                            onChange={(event) => setIsFree(event.target.checked)}
                            disabled={!editable}
                          />
                          Бесплатно
                        </label>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <input type="hidden" name="priceText" value="" />
                      <input type="hidden" name="isFree" value="" />
                    </>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {usesAge ? (
                      <FormField id="candidate-age" label="Возрастное ограничение" error={errors.ageLimit}>
                        <Input
                          id="candidate-age"
                          name="ageLimit"
                          value={ageLimit}
                          onChange={(event) => setAgeLimit(event.target.value)}
                          maxLength={40}
                          aria-invalid={Boolean(errors.ageLimit)}
                          aria-describedby={fieldDescriptionId("candidate-age", errors.ageLimit)}
                          disabled={!editable}
                        />
                      </FormField>
                    ) : <input type="hidden" name="ageLimit" value="" />}
                    {usesPhone ? (
                      <FormField id="candidate-contact-phone" label="Контактный телефон" error={errors.contactPhone}>
                        <Input
                          id="candidate-contact-phone"
                          name="contactPhone"
                          type="tel"
                          value={contactPhone}
                          onChange={(event) => setContactPhone(event.target.value)}
                          maxLength={80}
                          aria-invalid={Boolean(errors.contactPhone)}
                          aria-describedby={fieldDescriptionId("candidate-contact-phone", errors.contactPhone)}
                          disabled={!editable}
                        />
                      </FormField>
                    ) : <input type="hidden" name="contactPhone" value="" />}
                  </div>
                </section>
              ) : (
                <>
                  <input type="hidden" name="place" value="" />
                  <input type="hidden" name="priceText" value="" />
                  <input type="hidden" name="ageLimit" value="" />
                  <input type="hidden" name="contactPhone" value="" />
                </>
              )}

              <section className="space-y-4" aria-labelledby="candidate-image-heading">
                <div className="space-y-1">
                  <h2 id="candidate-image-heading" className="text-xl font-semibold">Изображение</h2>
                  <p className="text-sm leading-6 text-foreground-muted">
                    Сохраняется только URL первичного источника. Сам файл копируется после одобрения.
                  </p>
                </div>
                <FormField id="candidate-image-source" label="URL изображения" error={errors.imageSourceUrl}>
                  <Input
                    id="candidate-image-source"
                    name="imageSourceUrl"
                    type="url"
                    value={imageSourceUrl}
                    onChange={(event) => setImageSourceUrl(event.target.value)}
                    maxLength={1000}
                    aria-invalid={Boolean(errors.imageSourceUrl)}
                    aria-describedby={fieldDescriptionId("candidate-image-source", errors.imageSourceUrl)}
                    disabled={!editable}
                  />
                </FormField>
              </section>
            </>
          ) : (
            <>
              <input type="hidden" name="publicationType" value={publicationType} />
              <input type="hidden" name="categorySlug" value={categorySlug} />
              <input type="hidden" name="title" value={title} />
              <input type="hidden" name="description" value={description} />
              <input type="hidden" name="startsAt" value={startsAt} />
              <input type="hidden" name="endsAt" value={endsAt} />
              <input type="hidden" name="validUntil" value={validUntil} />
              <input type="hidden" name="sourcePublishedAt" value={sourcePublishedAt} />
              <input type="hidden" name="place" value={place} />
              <input type="hidden" name="priceText" value={priceText} />
              <input type="hidden" name="ageLimit" value={ageLimit} />
              <input type="hidden" name="contactPhone" value={contactPhone} />
              <input type="hidden" name="imageSourceUrl" value={imageSourceUrl} />
              <input type="hidden" name="scheduleEntries" value={scheduleJson} />
              {isFree ? <input type="hidden" name="isFree" value="on" /> : null}
            </>
          )}
        </>
      ) : null}

      {editable ? (
        <section className="space-y-4" aria-labelledby="candidate-decision-heading">
          <div className="space-y-1">
            <h2 id="candidate-decision-heading" className="text-xl font-semibold">Сохранение и решение</h2>
            <p className="text-sm leading-6 text-foreground-muted">
              «Сохранить правки» не меняет публичные данные. Причина отклонения видна только администраторам.
            </p>
          </div>
          <FormField
            id="candidate-review-comment"
            label="Внутренний комментарий"
            hint="Для отклонения укажите минимум 3 символа."
            error={errors.reviewComment}
          >
            <Textarea
              id="candidate-review-comment"
              name="reviewComment"
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              maxLength={2000}
              aria-invalid={Boolean(errors.reviewComment)}
              aria-describedby={fieldDescriptionId("candidate-review-comment", errors.reviewComment, true)}
            />
          </FormField>
          <ContentIngestionActionMessage state={state} />
          <p className="text-sm text-foreground-muted" role="status">
            {dirty ? "Есть несохранённые изменения." : "Все изменения сохранены."}
          </p>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="intent" value="save_changes" variant="outline" pendingLabel="Сохраняем…">
              Сохранить правки
            </SubmitButton>
            <SubmitButton name="intent" value="approve_publish" pendingLabel="Применяем…">
              {payload.kind === "organization"
                ? "Создать организацию"
                : candidateAction === "cancel_publication"
                  ? "Подтвердить отмену"
                  : candidateAction === "update_publication"
                    ? "Применить обновление"
                    : "Опубликовать"}
            </SubmitButton>
            {payload.kind === "publication" && candidateAction !== "cancel_publication" ? (
              <SubmitButton name="intent" value="approve_draft" variant="secondary" pendingLabel="Создаём черновик…">
                Создать черновик
              </SubmitButton>
            ) : null}
            <SubmitButton name="intent" value="reject" variant="destructive" pendingLabel="Отклоняем…">
              Отклонить
            </SubmitButton>
            {status === "duplicate" ? (
              <SubmitButton name="intent" value="mark_not_duplicate" variant="secondary" pendingLabel="Сохраняем…">
                Это не дубль
              </SubmitButton>
            ) : null}
          </div>
        </section>
      ) : (
        <ContentIngestionActionMessage state={state} />
      )}
    </form>
  );
}
