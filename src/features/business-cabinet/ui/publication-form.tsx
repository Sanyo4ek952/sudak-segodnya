"use client";

import { useActionState } from "react";
import { savePublicationAction } from "@/features/business-cabinet/model/actions";
import {
  businessPublicationStatusLabels,
  businessPublicationTypeLabels,
  initialBusinessActionState
} from "@/features/business-cabinet/model/types";
import type { BusinessPublication } from "@/features/business-cabinet/model/types";
import type { Tables } from "@/shared/api/supabase/database.types";
import { BusinessActionMessage } from "@/features/business-cabinet/ui/business-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

function toInputDateTime(value: string | null | undefined) {
  return value ? value.slice(0, 16) : "";
}

export function PublicationForm({
  organizationId,
  publication,
  categories
}: {
  organizationId: string;
  publication?: BusinessPublication | null;
  categories: Array<Pick<Tables<"publication_categories">, "id" | "name">>;
}) {
  const [state, action] = useActionState(savePublicationAction, initialBusinessActionState);
  const schedule = publication?.publication_schedules?.[0]?.schedule_text ?? "";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="publicationId" value={publication?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="type" label="Тип">
          <Select id="type" name="type" defaultValue={publication?.type ?? "event"} required>
            {Object.entries(businessPublicationTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </FormField>
        <FormField id="status" label="Статус">
          <Select id="status" name="status" defaultValue={publication?.status ?? "draft"} required>
            {(["draft", "scheduled", "moderation", "published"] as const).map((status) => (
              <option key={status} value={status}>{businessPublicationStatusLabels[status]}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField id="title" label="Название">
        <Input id="title" name="title" required defaultValue={publication?.title ?? ""} />
      </FormField>
      <FormField id="description" label="Описание">
        <Textarea id="description" name="description" required defaultValue={publication?.description ?? ""} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="categoryId" label="Категория ленты">
          <Select id="categoryId" name="categoryId" defaultValue={publication?.category_id ?? categories[0]?.id ?? ""} required>
            {categories.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField id="priceText" label="Цена">
          <Input id="priceText" name="priceText" defaultValue={publication?.price_text ?? ""} />
        </FormField>
      </div>
      <label className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface px-3 text-sm">
        <input type="checkbox" name="isFree" defaultChecked={publication?.is_free ?? false} />
        Бесплатное участие
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="startsAt" label="Начало">
          <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toInputDateTime(publication?.starts_at)} />
        </FormField>
        <FormField id="endsAt" label="Окончание">
          <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toInputDateTime(publication?.ends_at)} />
        </FormField>
        <FormField id="validUntil" label="Актуально до">
          <Input id="validUntil" name="validUntil" type="datetime-local" defaultValue={toInputDateTime(publication?.valid_until)} />
        </FormField>
      </div>
      <FormField id="scheduleText" label="Расписание для регулярного занятия">
        <Textarea id="scheduleText" name="scheduleText" defaultValue={schedule} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="place" label="Место">
          <Input id="place" name="place" defaultValue={publication?.place ?? ""} />
        </FormField>
        <FormField id="ageLimit" label="Возраст">
          <Input id="ageLimit" name="ageLimit" defaultValue={publication?.age_limit ?? ""} />
        </FormField>
        <FormField id="contactPhone" label="Телефон">
          <Input id="contactPhone" name="contactPhone" defaultValue={publication?.contact_phone ?? ""} />
        </FormField>
      </div>
      <BusinessActionMessage state={state} />
      <SubmitButton pendingLabel="Сохраняем...">Сохранить публикацию</SubmitButton>
    </form>
  );
}
