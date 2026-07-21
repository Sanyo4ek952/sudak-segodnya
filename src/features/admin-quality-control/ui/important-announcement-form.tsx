"use client";

import { useActionState } from "react";
import { saveImportantAnnouncementAction } from "@/features/admin-quality-control/model/actions";
import {
  type AdminAnnouncementListItem,
  initialAdminActionState
} from "@/features/admin-quality-control/model/types";
import { AdminActionMessage } from "@/features/admin-quality-control/ui/admin-action-message";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

type ImportantAnnouncementFormProps = {
  announcement?: AdminAnnouncementListItem | null;
  onCancelHref?: string;
};

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 16);
}

export function ImportantAnnouncementForm({
  announcement,
  onCancelHref
}: ImportantAnnouncementFormProps) {
  const [state, action] = useActionState(saveImportantAnnouncementAction, initialAdminActionState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="announcementId" value={announcement?.id ?? ""} />
      <FormField id="announcementTitle" label="Заголовок">
        <Input id="announcementTitle" name="title" defaultValue={announcement?.title ?? ""} required />
      </FormField>
      <FormField id="announcementDescription" label="Описание">
        <Textarea
          id="announcementDescription"
          name="description"
          defaultValue={announcement?.description ?? ""}
          required
          maxLength={1000}
        />
      </FormField>
      <FormField id="announcementStatus" label="Статус">
        <Select id="announcementStatus" name="status" defaultValue={announcement?.status ?? "draft"}>
          <option value="draft">Черновик</option>
          <option value="active">Активно</option>
          <option value="expired">Завершено</option>
          <option value="hidden">Снято</option>
        </Select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="announcementActiveFrom" label="Показывать с">
          <Input
            id="announcementActiveFrom"
            name="activeFrom"
            type="datetime-local"
            defaultValue={toDateTimeLocal(announcement?.active_from ?? null)}
          />
        </FormField>
        <FormField id="announcementActiveUntil" label="Показывать до">
          <Input
            id="announcementActiveUntil"
            name="activeUntil"
            type="datetime-local"
            defaultValue={toDateTimeLocal(announcement?.active_until ?? null)}
          />
        </FormField>
      </div>
      <FormField id="announcementPublicationSlug" label="Slug связанной публикации">
        <Input
          id="announcementPublicationSlug"
          name="publicationSlug"
          defaultValue={announcement?.publications?.slug ?? ""}
          placeholder="vecher-na-naberezhnoy"
        />
      </FormField>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {onCancelHref ? (
          <Button type="button" variant="outline" onClick={() => window.location.assign(onCancelHref)}>
            Отмена
          </Button>
        ) : null}
        <SubmitButton pendingLabel="Сохраняем...">Сохранить</SubmitButton>
      </div>
      <AdminActionMessage state={state} />
    </form>
  );
}
