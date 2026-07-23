"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { savePublicationAction } from "@/features/business-cabinet/model/actions";
import {
  businessPublicationTypeLabels,
  initialBusinessActionState
} from "@/features/business-cabinet/model/types";
import type { BusinessPublication } from "@/features/business-cabinet/model/types";
import type { PublicationScheduleEntryInput } from "@/entities/publication/model/publication-contract";
import type { Tables } from "@/shared/api/supabase/database.types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { BusinessActionMessage } from "@/features/business-cabinet/ui/business-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/cn";

const steps = [
  "Тип",
  "Содержание",
  "Актуальность",
  "Место и цена",
  "Изображение",
  "Предпросмотр"
] as const;

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

function toInputDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const moscow = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return moscow.toISOString().slice(0, 16);
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

function getInitialSchedule(publication?: BusinessPublication | null) {
  const entries = publication?.publication_schedules
    ?.slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((entry) => ({
      scheduleText: entry.schedule_text,
      weekday: entry.weekday,
      startsAt: entry.starts_at?.slice(0, 5) ?? null,
      endsAt: entry.ends_at?.slice(0, 5) ?? null,
      sortOrder: entry.sort_order,
      timezone: entry.timezone
    }));

  return entries?.length ? entries : [createEmptyScheduleEntry(0)];
}

function formatPreviewDate(value: string) {
  if (!value) {
    return "Не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow"
  }).format(new Date(`${value}:00+03:00`));
}

export function PublicationForm({
  organizationId,
  publication,
  categories,
  draftPublicationId,
  clientRequestId
}: {
  organizationId: string;
  publication?: BusinessPublication | null;
  categories: Array<Pick<Tables<"publication_categories">, "id" | "name">>;
  draftPublicationId: string;
  clientRequestId: string;
}) {
  const [state, action] = useActionState(savePublicationAction, initialBusinessActionState);
  const [step, setStep] = useState(0);
  const [type, setType] = useState<Tables<"publications">["type"]>(publication?.type ?? "event");
  const [title, setTitle] = useState(publication?.title ?? "");
  const [description, setDescription] = useState(publication?.description ?? "");
  const [categoryId, setCategoryId] = useState(publication?.category_id ?? categories[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState(toInputDateTime(publication?.starts_at));
  const [endsAt, setEndsAt] = useState(toInputDateTime(publication?.ends_at));
  const [validUntil, setValidUntil] = useState(toInputDateTime(publication?.valid_until));
  const [publishAt, setPublishAt] = useState(toInputDateTime(publication?.publish_at));
  const [place, setPlace] = useState(publication?.place ?? "");
  const [priceText, setPriceText] = useState(publication?.price_text ?? "");
  const [isFree, setIsFree] = useState(publication?.is_free ?? false);
  const [ageLimit, setAgeLimit] = useState(publication?.age_limit ?? "");
  const [contactPhone, setContactPhone] = useState(publication?.contact_phone ?? "");
  const [scheduleEntries, setScheduleEntries] = useState(() => getInitialSchedule(publication));
  const [localImageUrl, setLocalImageUrl] = useState<string>();
  const [previewMode, setPreviewMode] = useState<"card" | "detail">("card");

  useEffect(() => {
    return () => {
      if (localImageUrl) {
        URL.revokeObjectURL(localImageUrl);
      }
    };
  }, [localImageUrl]);

  const publicationId = state.publicationId ?? publication?.id ?? draftPublicationId;
  const imageUrl = state.imageRemoved
    ? undefined
    : state.imageUrl ?? localImageUrl ?? publication?.imageUrl;
  const scheduleJson = useMemo(
    () => JSON.stringify(
      scheduleEntries
        .filter((entry) => entry.scheduleText.trim())
        .map((entry, index) => ({ ...entry, sortOrder: index }))
    ),
    [scheduleEntries]
  );
  const currentStatus = publication?.status ?? "draft";
  const uploadIntent = currentStatus === "published"
    ? "publish"
    : currentStatus === "scheduled"
      ? "schedule"
      : "draft";
  const showPlace = type === "event" || type === "regular";
  const showPrice = type !== "news";
  const previewTiming = type === "event"
    ? `${formatPreviewDate(startsAt)} — ${formatPreviewDate(endsAt)}`
    : type === "regular"
      ? scheduleEntries.map((entry) => entry.scheduleText).filter(Boolean).join(", ") || "Расписание не указано"
      : `Актуально до ${formatPreviewDate(validUntil)}`;

  function updateScheduleEntry(
    index: number,
    patch: Partial<PublicationScheduleEntryInput>
  ) {
    setScheduleEntries((entries) => entries.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...patch } : entry
    )));
  }

  function selectImage(file?: File) {
    if (localImageUrl) {
      URL.revokeObjectURL(localImageUrl);
    }
    setLocalImageUrl(file ? URL.createObjectURL(file) : undefined);
  }

  return (
    <form action={action} className="space-y-6" encType="multipart/form-data">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="publicationId" value={publicationId} />
      <input type="hidden" name="clientRequestId" value={clientRequestId} />
      <input type="hidden" name="scheduleEntries" value={scheduleJson} />
      <input type="hidden" name="uploadIntent" value={uploadIntent} />

      <div className="space-y-3" aria-label="Этапы создания публикации">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Шаг {step + 1} из {steps.length}</span>
          <span className="text-foreground-muted">{steps[step]}</span>
        </div>
        <div className="grid grid-cols-6 gap-1" aria-hidden="true">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              className={cn(
                "h-2 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                index <= step ? "bg-primary" : "bg-surface-muted"
              )}
              onClick={() => setStep(index)}
              aria-label={`Перейти к шагу ${index + 1}: ${label}`}
            />
          ))}
        </div>
      </div>

      <section hidden={step !== 0} className="space-y-4" aria-labelledby="publication-step-type">
        <div className="space-y-1">
          <h2 id="publication-step-type" className="text-xl font-semibold">Что вы публикуете?</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            От типа зависят даты, расписание и поля следующего шага.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(businessPublicationTypeLabels).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-md border p-4 transition",
                type === value
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-surface hover:bg-surface-muted"
              )}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value as Tables<"publications">["type"])}
              />
              <span className="font-medium">{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section hidden={step !== 1} className="space-y-4" aria-labelledby="publication-step-content">
        <div className="space-y-1">
          <h2 id="publication-step-content" className="text-xl font-semibold">Содержание</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            Напишите коротко и конкретно: что произойдёт или что важно знать.
          </p>
        </div>
        <FormField id="title" label="Название">
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-required="true"
            maxLength={180}
          />
        </FormField>
        <FormField id="description" label={type === "promo" ? "Условия акции" : "Описание"}>
          <Textarea
            id="description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-required="true"
            maxLength={4000}
            rows={7}
          />
        </FormField>
        <FormField id="categoryId" label="Категория ленты">
          <Select
            id="categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-required="true"
          >
            {categories.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </Select>
        </FormField>
      </section>

      <section hidden={step !== 2} className="space-y-4" aria-labelledby="publication-step-time">
        <div className="space-y-1">
          <h2 id="publication-step-time" className="text-xl font-semibold">
            {type === "event" ? "Когда проходит мероприятие" : "Срок актуальности"}
          </h2>
          <p className="text-sm leading-6 text-foreground-muted">
            Время интерпретируется в часовом поясе Судака — Europe/Moscow.
          </p>
        </div>

        {type === "event" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="startsAt" label="Начало">
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                aria-required="true"
              />
            </FormField>
            <FormField id="endsAt" label="Окончание">
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                aria-required="true"
              />
            </FormField>
          </div>
        ) : (
          <FormField id="validUntil" label="Актуально до">
            <Input
              id="validUntil"
              name="validUntil"
              type="datetime-local"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              aria-required="true"
            />
          </FormField>
        )}

        {type === "regular" ? (
          <div className="space-y-4 rounded-md border border-border bg-surface-muted p-4">
            <div className="space-y-1">
              <h3 className="font-semibold">Регулярное расписание</h3>
              <p className="text-sm text-foreground-muted">
                Структурированные дни и время используются фильтрами «Сегодня» и «Завтра».
              </p>
            </div>
            {scheduleEntries.map((entry, index) => (
              <div key={index} className="space-y-3 rounded-md border border-border bg-surface p-3">
                <FormField id={`scheduleText-${index}`} label="Пояснение">
                  <Input
                    id={`scheduleText-${index}`}
                    value={entry.scheduleText}
                    onChange={(event) => updateScheduleEntry(index, { scheduleText: event.target.value })}
                    placeholder="Например: по будням, кроме праздников"
                    required
                  />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField id={`weekday-${index}`} label="День недели">
                    <Select
                      id={`weekday-${index}`}
                      value={entry.weekday?.toString() ?? ""}
                      onChange={(event) => updateScheduleEntry(index, {
                        weekday: event.target.value ? Number(event.target.value) : null
                      })}
                    >
                      {weekdayOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField id={`scheduleStart-${index}`} label="Начало">
                    <Input
                      id={`scheduleStart-${index}`}
                      type="time"
                      required
                      value={entry.startsAt ?? ""}
                      onChange={(event) => updateScheduleEntry(index, {
                        startsAt: event.target.value || null
                      })}
                    />
                  </FormField>
                  <FormField id={`scheduleEnd-${index}`} label="Окончание">
                    <Input
                      id={`scheduleEnd-${index}`}
                      type="time"
                      value={entry.endsAt ?? ""}
                      onChange={(event) => updateScheduleEntry(index, {
                        endsAt: event.target.value || null
                      })}
                    />
                  </FormField>
                </div>
                {scheduleEntries.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setScheduleEntries((entries) => entries.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    Удалить интервал
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setScheduleEntries((entries) => [
                ...entries,
                createEmptyScheduleEntry(entries.length)
              ])}
            >
              Добавить интервал
            </Button>
          </div>
        ) : null}

        <div className="rounded-md border border-border p-4">
          <FormField id="publishAt" label="Опубликовать позже (необязательно)">
            <Input
              id="publishAt"
              name="publishAt"
              type="datetime-local"
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
            />
          </FormField>
          <p className="mt-2 text-xs leading-5 text-foreground-muted">
            Если заполнить это поле, на последнем шаге станет доступно действие «Запланировать».
          </p>
        </div>
      </section>

      <section hidden={step !== 3} className="space-y-4" aria-labelledby="publication-step-place">
        <div className="space-y-1">
          <h2 id="publication-step-place" className="text-xl font-semibold">Место, цена и контакты</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            Показываются только сведения, применимые к выбранному типу.
          </p>
        </div>
        {showPlace ? (
          <FormField id="place" label="Место">
            <Input
              id="place"
              name="place"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              aria-required="true"
              maxLength={300}
            />
          </FormField>
        ) : (
          <input type="hidden" name="place" value="" />
        )}
        {showPrice ? (
          <div className="space-y-3">
            <FormField id="priceText" label={type === "promo" ? "Цена или условия предложения" : "Цена"}>
              <Input
                id="priceText"
                name="priceText"
                value={priceText}
                onChange={(event) => setPriceText(event.target.value)}
                disabled={isFree}
                maxLength={120}
              />
            </FormField>
            <label className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface px-3 text-sm">
              <input
                type="checkbox"
                name="isFree"
                checked={isFree}
                onChange={(event) => setIsFree(event.target.checked)}
              />
              Бесплатно
            </label>
          </div>
        ) : (
          <>
            <input type="hidden" name="priceText" value="" />
            <input type="hidden" name="isFree" value="" />
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {(type === "event" || type === "regular") ? (
            <FormField id="ageLimit" label="Возрастное ограничение">
              <Input
                id="ageLimit"
                name="ageLimit"
                value={ageLimit}
                onChange={(event) => setAgeLimit(event.target.value)}
                placeholder="Например: 6+"
              />
            </FormField>
          ) : (
            <input type="hidden" name="ageLimit" value="" />
          )}
          <FormField id="contactPhone" label="Телефон для уточнений">
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section hidden={step !== 4} className="space-y-4" aria-labelledby="publication-step-image">
        <div className="space-y-1">
          <h2 id="publication-step-image" className="text-xl font-semibold">Изображение</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            Необязательно. JPG, PNG или WebP до 5 МБ.
          </p>
        </div>
        {imageUrl ? (
          <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-surface-muted">
            <Image src={imageUrl} alt="" fill unoptimized className="object-cover" />
          </div>
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center rounded-md bg-surface-muted px-6 text-center text-sm text-foreground-muted">
            Публикация будет показана без изображения.
          </div>
        )}
        <FormField id="image" label={imageUrl ? "Заменить изображение" : "Выбрать изображение"}>
          <Input
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => selectImage(event.target.files?.[0])}
          />
        </FormField>
        <div className="flex flex-wrap gap-3">
          <SubmitButton
            name="intent"
            value="upload-image"
            variant="outline"
            pendingLabel="Загружаем..."
          >
            {imageUrl ? "Заменить" : "Загрузить"}
          </SubmitButton>
          {imageUrl ? (
            <SubmitButton
              name="intent"
              value="remove-image"
              variant="ghost"
              pendingLabel="Удаляем..."
            >
              Удалить изображение
            </SubmitButton>
          ) : null}
        </div>
      </section>

      <section hidden={step !== 5} className="space-y-4" aria-labelledby="publication-step-preview">
        <div className="space-y-1">
          <h2 id="publication-step-preview" className="text-xl font-semibold">Предпросмотр</h2>
          <p className="text-sm leading-6 text-foreground-muted">
            Проверьте карточку ленты и основные сведения страницы публикации.
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Вид предпросмотра">
          <Button
            type="button"
            variant={previewMode === "card" ? "primary" : "outline"}
            size="sm"
            onClick={() => setPreviewMode("card")}
          >
            Карточка
          </Button>
          <Button
            type="button"
            variant={previewMode === "detail" ? "primary" : "outline"}
            size="sm"
            onClick={() => setPreviewMode("detail")}
          >
            Страница
          </Button>
        </div>
        <article className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          {imageUrl ? (
            <div className="relative aspect-[16/9] bg-surface-muted">
              <Image src={imageUrl} alt="" fill unoptimized className="object-cover" />
            </div>
          ) : null}
          <div className={cn("space-y-4 p-4", previewMode === "detail" && "sm:p-6")}>
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{businessPublicationTypeLabels[type]}</Badge>
              {isFree && showPrice ? <Badge variant="success">Бесплатно</Badge> : null}
            </div>
            <div className="space-y-2">
              <h3 className={cn("font-semibold leading-snug", previewMode === "detail" ? "text-2xl" : "text-lg")}>
                {title || "Название публикации"}
              </h3>
              <p className={cn(
                "text-sm leading-6 text-foreground-muted",
                previewMode === "card" && "line-clamp-2"
              )}>
                {description || "Здесь появится описание публикации."}
              </p>
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium">Когда:</dt>
                <dd className="text-foreground-muted">{previewTiming}</dd>
              </div>
              {showPlace && place ? (
                <div className="flex gap-2">
                  <dt className="font-medium">Где:</dt>
                  <dd className="text-foreground-muted">{place}</dd>
                </div>
              ) : null}
              {showPrice ? (
                <div className="flex gap-2">
                  <dt className="font-medium">Цена:</dt>
                  <dd className="text-foreground-muted">
                    {isFree ? "Бесплатно" : priceText || "Не указана"}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </article>
      </section>

      <BusinessActionMessage state={state} />
      {state.status === "success" && state.publicationHref ? (
        <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" href={state.publicationHref}>
          Открыть публичную страницу
        </Link>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          Назад
        </Button>
        {step < steps.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
          >
            Продолжить
          </Button>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            {currentStatus === "published" ? (
              <SubmitButton name="intent" value="publish" pendingLabel="Сохраняем...">
                Сохранить изменения
              </SubmitButton>
            ) : (
              <>
                <SubmitButton name="intent" value="draft" variant="outline" pendingLabel="Сохраняем...">
                  {currentStatus === "scheduled" ? "Сохранить как черновик" : "Сохранить черновик"}
                </SubmitButton>
                {publishAt ? (
                  <SubmitButton name="intent" value="schedule" variant="secondary" pendingLabel="Планируем...">
                    Запланировать
                  </SubmitButton>
                ) : null}
                <SubmitButton name="intent" value="publish" pendingLabel="Публикуем...">
                  Опубликовать
                </SubmitButton>
              </>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
