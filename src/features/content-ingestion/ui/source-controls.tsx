"use client";

import { useActionState } from "react";
import {
  createContentSourceAction,
  enqueueManualUrlAction,
  runContentIngestionNowAction
} from "@/features/content-ingestion/model/actions";
import { initialContentIngestionActionState } from "@/features/content-ingestion/model/types";
import { ContentIngestionActionMessage } from "@/features/content-ingestion/ui/content-ingestion-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";

export function ManualUrlForm() {
  const [state, action] = useActionState(enqueueManualUrlAction, initialContentIngestionActionState);
  return (
    <form action={action} className="space-y-3">
      <FormField id="manual-source-url" label="Обработать URL" hint="Только публичный HTTPS-адрес первичного источника.">
        <Input id="manual-source-url" name="url" type="url" placeholder="https://example.org/event" required />
      </FormField>
      <ContentIngestionActionMessage state={state} />
      <SubmitButton pendingLabel="Обрабатываем…">Добавить в очередь</SubmitButton>
    </form>
  );
}

export function CreateSourceForm() {
  const [state, action] = useActionState(createContentSourceAction, initialContentIngestionActionState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <FormField id="source-name" label="Название источника">
        <Input id="source-name" name="name" maxLength={180} required />
      </FormField>
      <FormField id="source-url" label="URL">
        <Input id="source-url" name="url" type="url" required />
      </FormField>
      <FormField id="source-kind" label="Формат">
        <Select id="source-kind" name="kind" defaultValue="html">
          <option value="html">HTML / JSON-LD / адаптер</option>
          <option value="rss">RSS / Atom</option>
        </Select>
      </FormField>
      <FormField id="source-trust" label="Доверие">
        <Select id="source-trust" name="trustLevel" defaultValue="official">
          <option value="official">Официальный</option>
          <option value="partner">Партнёрский</option>
          <option value="discovery">Только обнаружение</option>
        </Select>
      </FormField>
      <div className="sm:col-span-2"><ContentIngestionActionMessage state={state} /></div>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Добавляем…">Добавить источник</SubmitButton></div>
    </form>
  );
}

export function RunIngestionForm() {
  const [state, action] = useActionState(runContentIngestionNowAction, initialContentIngestionActionState);
  return (
    <form action={action} className="space-y-2">
      <ContentIngestionActionMessage state={state} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Запускаем…">Запустить сейчас</SubmitButton>
    </form>
  );
}
