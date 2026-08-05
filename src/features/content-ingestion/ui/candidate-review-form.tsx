"use client";

import { useActionState, useState } from "react";
import type {
  ContentCandidateAction,
  ContentCandidatePayload,
  OrganizationCandidatePayload
} from "@/features/content-ingestion/model/contracts";
import {
  initialContentIngestionActionState
} from "@/features/content-ingestion/model/types";
import {
  reviewContentCandidateAction
} from "@/features/content-ingestion/model/actions";
import { ContentIngestionActionMessage } from "@/features/content-ingestion/ui/content-ingestion-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

type Option = { id: string; name: string; slug: string };
type PublicationOption = {
  id: string;
  organization_id: string;
  title: string;
  starts_at: string | null;
  valid_until: string | null;
};

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

function OrganizationCandidateFields({
  payload,
  organizationTypes,
  editable,
  idPrefix,
  namePrefix = ""
}: {
  payload: OrganizationCandidatePayload;
  organizationTypes: Option[];
  editable: boolean;
  idPrefix: string;
  namePrefix?: string;
}) {
  const fieldName = (name: string) => namePrefix
    ? `${namePrefix}${name.charAt(0).toUpperCase()}${name.slice(1)}`
    : name;

  return (
    <>
      <FormField id={`${idPrefix}-name`} label="Название">
        <Input id={`${idPrefix}-name`} name={fieldName("name")} defaultValue={payload.name} maxLength={160} disabled={!editable} required />
      </FormField>
      <FormField id={`${idPrefix}-type`} label="Тип организации">
        <Select id={`${idPrefix}-type`} name={fieldName("typeSlug")} defaultValue={payload.typeSlug} disabled={!editable} required>
          {organizationTypes.map((option) => <option key={option.id} value={option.slug}>{option.name}</option>)}
        </Select>
      </FormField>
      <FormField id={`${idPrefix}-description`} label="Описание" hint="Обязательно для создания активной организации.">
        <Textarea id={`${idPrefix}-description`} name={fieldName("description")} defaultValue={payload.description ?? ""} maxLength={4000} disabled={!editable} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${idPrefix}-address`} label="Адрес">
          <Input id={`${idPrefix}-address`} name={fieldName("address")} defaultValue={payload.address ?? ""} maxLength={500} disabled={!editable} />
        </FormField>
        <FormField id={`${idPrefix}-phone`} label="Телефон" hint="Обязателен для активной организации.">
          <Input id={`${idPrefix}-phone`} name={fieldName("phone")} defaultValue={payload.phone ?? ""} maxLength={80} disabled={!editable} />
        </FormField>
      </div>
      <FormField id={`${idPrefix}-working-hours`} label="График работы">
        <Textarea id={`${idPrefix}-working-hours`} name={fieldName("workingHours")} defaultValue={payload.workingHours ?? ""} maxLength={1000} disabled={!editable} />
      </FormField>
      <FormField id={`${idPrefix}-image-source`} label="URL изображения источника" hint="Изображение будет безопасно скопировано в приватное хранилище после одобрения.">
        <Input id={`${idPrefix}-image-source`} name={fieldName("imageSourceUrl")} type="url" defaultValue={payload.imageSourceUrl ?? ""} maxLength={1000} disabled={!editable} />
      </FormField>
      <input type="hidden" name={fieldName("contactLinks")} value={JSON.stringify(payload.contactLinks)} />
    </>
  );
}

export function CandidateReviewForm({
  candidateId,
  action: candidateAction,
  status,
  payload,
  organizations,
  categories,
  organizationTypes,
  publications,
  dependencyOrganization,
  targetOrganizationId
}: {
  candidateId: string;
  action: ContentCandidateAction;
  status: string;
  payload: ContentCandidatePayload;
  organizations: Option[];
  categories: Option[];
  organizationTypes: Option[];
  publications: PublicationOption[];
  dependencyOrganization: {
    id: string;
    status: string;
    payload: OrganizationCandidatePayload;
  } | null;
  targetOrganizationId: string | null;
}) {
  const [state, action] = useActionState(reviewContentCandidateAction, initialContentIngestionActionState);
  const editable = status === "pending" || status === "duplicate";
  const canCreateDependency = dependencyOrganization?.status === "pending";
  const [organizationChoice, setOrganizationChoice] = useState(
    payload.kind === "publication"
      ? payload.organizationId ?? targetOrganizationId ?? (canCreateDependency ? "create_dependency" : "")
      : ""
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="payloadKind" value={payload.kind} />

      {payload.kind === "organization" ? (
        <OrganizationCandidateFields
          payload={payload}
          organizationTypes={organizationTypes}
          editable={editable}
          idPrefix="candidate"
        />
      ) : (
        <>
          <FormField id="candidate-organization" label="Организация" hint="Выберите существующую организацию или явно создайте новую из импортированного кандидата.">
            <Select
              id="candidate-organization"
              name="organizationId"
              value={organizationChoice}
              onChange={(event) => setOrganizationChoice(event.target.value)}
              disabled={!editable}
            >
              <option value="">Не сопоставлена — публикация недоступна</option>
              {canCreateDependency && dependencyOrganization ? (
                <option value="create_dependency">Создать новую «{dependencyOrganization.payload.name}»</option>
              ) : null}
              {organizations.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </Select>
          </FormField>
          {organizationChoice === "create_dependency" && dependencyOrganization ? (
            <div className="space-y-4 rounded-lg border border-border bg-surface-muted p-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">Новая организация</h3>
                <p className="text-sm leading-6 text-foreground-muted">
                  Проверьте данные. Организация и публикация создадутся одной операцией; при ошибке не сохранится ни одна из них.
                </p>
              </div>
              <OrganizationCandidateFields
                payload={dependencyOrganization.payload}
                organizationTypes={organizationTypes}
                editable={editable}
                idPrefix="dependency"
                namePrefix="dependency"
              />
            </div>
          ) : null}
          {candidateAction === "update_publication" || candidateAction === "cancel_publication" ? (
            <FormField
              id="candidate-target-publication"
              label="Целевая публикация"
              hint="Обязательно для обновления или отмены."
            >
              <Select
                id="candidate-target-publication"
                name="targetPublicationId"
                defaultValue={payload.targetPublicationId ?? ""}
                disabled={!editable}
                required
              >
                <option value="">Выберите существующую публикацию</option>
                {publications.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title} · {option.starts_at ?? option.valid_until ?? "без даты"}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <input type="hidden" name="targetPublicationId" value={payload.targetPublicationId ?? ""} />
          )}
          <input type="hidden" name="organizationName" value={payload.organizationName} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="candidate-publication-type" label="Тип публикации">
              <Select id="candidate-publication-type" name="publicationType" defaultValue={payload.type} disabled={!editable}>
                <option value="event">Мероприятие</option>
                <option value="announcement">Объявление</option>
                <option value="promo">Акция</option>
                <option value="regular">Регулярное занятие</option>
                <option value="news">Новость</option>
              </Select>
            </FormField>
            <FormField id="candidate-category" label="Категория ленты">
              <Select id="candidate-category" name="categorySlug" defaultValue={payload.categorySlug} disabled={!editable}>
                {categories.map((option) => <option key={option.id} value={option.slug}>{option.name}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField id="candidate-title" label="Название">
            <Input id="candidate-title" name="title" defaultValue={payload.title} maxLength={180} disabled={!editable} required />
          </FormField>
          <FormField id="candidate-publication-description" label="Описание">
            <Textarea id="candidate-publication-description" name="description" defaultValue={payload.description ?? ""} maxLength={4000} disabled={!editable} />
          </FormField>
          <FormField id="candidate-image-source" label="URL изображения источника" hint="Изображение будет безопасно скопировано в приватное хранилище после одобрения.">
            <Input id="candidate-image-source" name="imageSourceUrl" type="url" defaultValue={payload.imageSourceUrl ?? ""} maxLength={1000} disabled={!editable} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="candidate-starts-at" label="Начало">
              <Input id="candidate-starts-at" type="datetime-local" name="startsAt" defaultValue={toLocalDateTime(payload.startsAt)} disabled={!editable} />
            </FormField>
            <FormField id="candidate-ends-at" label="Окончание">
              <Input id="candidate-ends-at" type="datetime-local" name="endsAt" defaultValue={toLocalDateTime(payload.endsAt)} disabled={!editable} />
            </FormField>
          </div>
          <FormField id="candidate-valid-until" label="Актуально до">
            <Input id="candidate-valid-until" type="datetime-local" name="validUntil" defaultValue={toLocalDateTime(payload.validUntil)} disabled={!editable} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="candidate-place" label="Место">
              <Input id="candidate-place" name="place" defaultValue={payload.place ?? ""} maxLength={300} disabled={!editable} />
            </FormField>
            <FormField id="candidate-price" label="Цена или условия">
              <Input id="candidate-price" name="priceText" defaultValue={payload.priceText ?? ""} maxLength={120} disabled={!editable} />
            </FormField>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="isFree" defaultChecked={payload.isFree} disabled={!editable} />
            Бесплатно
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="candidate-age" label="Возраст">
              <Input id="candidate-age" name="ageLimit" defaultValue={payload.ageLimit ?? ""} maxLength={40} disabled={!editable} />
            </FormField>
            <FormField id="candidate-contact-phone" label="Контактный телефон">
              <Input id="candidate-contact-phone" name="contactPhone" defaultValue={payload.contactPhone ?? ""} maxLength={80} disabled={!editable} />
            </FormField>
          </div>
          <FormField id="candidate-schedule" label="Расписание (JSON)" hint="Массив интервалов для регулярных занятий.">
            <Textarea id="candidate-schedule" name="scheduleEntries" defaultValue={JSON.stringify(payload.scheduleEntries, null, 2)} disabled={!editable} className="font-mono text-xs" />
          </FormField>
        </>
      )}

      {editable ? (
        <FormField
          id="candidate-review-comment"
          label="Комментарий"
          hint="Внутренний комментарий: посетители не увидят его. Для отклонения он обязателен."
        >
          <Textarea id="candidate-review-comment" name="reviewComment" maxLength={2000} />
        </FormField>
      ) : null}

      <ContentIngestionActionMessage state={state} />

      {editable ? (
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="decision" value="approve_publish" pendingLabel="Публикуем…">
            {payload.kind === "organization" ? "Одобрить организацию" : "Одобрить и опубликовать"}
          </SubmitButton>
          {payload.kind === "publication" ? (
            <SubmitButton name="decision" value="approve_draft" variant="outline" pendingLabel="Сохраняем…">
              Сохранить как черновик
            </SubmitButton>
          ) : null}
          <SubmitButton name="decision" value="reject" variant="destructive" pendingLabel="Отклоняем…">
            Отклонить
          </SubmitButton>
          {status === "duplicate" ? (
            <SubmitButton name="decision" value="mark_not_duplicate" variant="secondary" pendingLabel="Обновляем…">
              Это не дубль
            </SubmitButton>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
