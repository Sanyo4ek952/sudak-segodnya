"use client";

import { useActionState, useState } from "react";
import {
  createContentIngestionDomainExclusionAction,
  createContentSourceAction,
  enqueueManualUrlAction,
  runContentIngestionNowAction,
  updateContentSourceAction
} from "@/features/content-ingestion/model/actions";
import {
  initialContentIngestionActionState,
  type ContentSourceRow
} from "@/features/content-ingestion/model/types";
import { ContentIngestionActionMessage } from "@/features/content-ingestion/ui/content-ingestion-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

type OrganizationOption = {
  id: string;
  name: string;
};

function fieldDescriptionId(id: string, error?: string, hasHint = false) {
  if (error) return `${id}-error`;
  return hasHint ? `${id}-hint` : undefined;
}

export function ManualUrlForm() {
  const [state, action] = useActionState(enqueueManualUrlAction, initialContentIngestionActionState);
  const [url, setUrl] = useState("");
  return (
    <form action={action} className="space-y-3">
      <FormField
        id="manual-source-url"
        label="Проверить разовый URL"
        hint="Страница обработается сейчас и создаст только кандидатов в закрытой очереди."
        error={state.fieldErrors?.url}
      >
        <Input
          id="manual-source-url"
          name="url"
          type="url"
          placeholder="https://example.org/event"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.url)}
          aria-describedby={state.fieldErrors?.url ? "manual-source-url-error" : "manual-source-url-hint"}
          required
        />
      </FormField>
      <ContentIngestionActionMessage state={state} />
      <SubmitButton pendingLabel="Проверяем…">Проверить страницу</SubmitButton>
    </form>
  );
}

export function CreateSourceForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, action] = useActionState(createContentSourceAction, initialContentIngestionActionState);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("html");
  const [trustLevel, setTrustLevel] = useState("official");
  const [organizationId, setOrganizationId] = useState("");
  const [fetchIntervalMinutes, setFetchIntervalMinutes] = useState("1440");
  const [notes, setNotes] = useState("");
  const [activateAfterTest, setActivateAfterTest] = useState(true);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <FormField id="source-name" label="Название источника" error={state.fieldErrors?.name}>
        <Input
          id="source-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={180}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby={fieldDescriptionId("source-name", state.fieldErrors?.name)}
          required
        />
      </FormField>
      <FormField id="source-url" label="URL" error={state.fieldErrors?.url}>
        <Input
          id="source-url"
          name="url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.url)}
          aria-describedby={fieldDescriptionId("source-url", state.fieldErrors?.url)}
          required
        />
      </FormField>
      <FormField id="source-kind" label="Формат" error={state.fieldErrors?.kind}>
        <Select
          id="source-kind"
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.kind)}
          aria-describedby={fieldDescriptionId("source-kind", state.fieldErrors?.kind)}
        >
          <option value="html">HTML / JSON-LD / адаптер</option>
          <option value="rss">RSS / Atom</option>
        </Select>
      </FormField>
      <FormField id="source-trust" label="Доверие" error={state.fieldErrors?.trustLevel}>
        <Select
          id="source-trust"
          name="trustLevel"
          value={trustLevel}
          onChange={(event) => setTrustLevel(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.trustLevel)}
          aria-describedby={fieldDescriptionId("source-trust", state.fieldErrors?.trustLevel)}
        >
          <option value="official">Официальный</option>
          <option value="partner">Партнёрский</option>
          <option value="discovery">Только обнаружение</option>
        </Select>
      </FormField>
      <FormField
        id="source-organization"
        label="Организация по умолчанию"
        hint="Для сайта одной организации публикации будут сопоставляться автоматически. Для агрегатора оставьте поле пустым."
        error={state.fieldErrors?.organizationId}
      >
        <Select
          id="source-organization"
          name="organizationId"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.organizationId)}
          aria-describedby={fieldDescriptionId("source-organization", state.fieldErrors?.organizationId, true)}
        >
          <option value="">Определять по содержимому</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>{organization.name}</option>
          ))}
        </Select>
      </FormField>
      <FormField
        id="source-interval"
        label="Интервал проверки, минут"
        hint="Минимум один час. Для большинства источников достаточно одного раза в сутки."
        error={state.fieldErrors?.fetchIntervalMinutes}
      >
        <Input
          id="source-interval"
          name="fetchIntervalMinutes"
          type="number"
          min="60"
          max="43200"
          value={fetchIntervalMinutes}
          onChange={(event) => setFetchIntervalMinutes(event.target.value)}
          inputMode="numeric"
          aria-invalid={Boolean(state.fieldErrors?.fetchIntervalMinutes)}
          aria-describedby={fieldDescriptionId("source-interval", state.fieldErrors?.fetchIntervalMinutes, true)}
        />
      </FormField>
      <div className="sm:col-span-2">
        <FormField id="source-notes" label="Внутренние заметки" error={state.fieldErrors?.notes}>
          <Textarea
            id="source-notes"
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            aria-invalid={Boolean(state.fieldErrors?.notes)}
            aria-describedby={fieldDescriptionId("source-notes", state.fieldErrors?.notes)}
            placeholder="Что именно импортируется и что нужно проверять вручную"
          />
        </FormField>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium sm:col-span-2">
        <input
          type="checkbox"
          name="activateAfterTest"
          checked={activateAfterTest}
          onChange={(event) => setActivateAfterTest(event.target.checked)}
        />
        Включить регулярный импорт после успешной проверки
      </label>
      <div className="sm:col-span-2"><ContentIngestionActionMessage state={state} /></div>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Проверяем…">Добавить и проверить</SubmitButton></div>
    </form>
  );
}

export function SourceSettingsForm({
  source,
  organizations
}: {
  source: ContentSourceRow;
  organizations: OrganizationOption[];
}) {
  const [state, action] = useActionState(updateContentSourceAction, initialContentIngestionActionState);
  const [organizationId, setOrganizationId] = useState(source.organization_id ?? "");
  const [fetchIntervalMinutes, setFetchIntervalMinutes] = useState(String(source.fetch_interval_minutes));
  const [notes, setNotes] = useState(source.notes ?? "");
  const organizationFieldId = `source-organization-${source.id}`;
  const intervalFieldId = `source-interval-${source.id}`;
  const notesFieldId = `source-notes-${source.id}`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sourceId" value={source.id} />
      <FormField
        id={organizationFieldId}
        label="Организация по умолчанию"
        error={state.fieldErrors?.organizationId}
      >
        <Select
          id={organizationFieldId}
          name="organizationId"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.organizationId)}
          aria-describedby={fieldDescriptionId(organizationFieldId, state.fieldErrors?.organizationId)}
        >
          <option value="">Определять по содержимому</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>{organization.name}</option>
          ))}
        </Select>
      </FormField>
      <FormField
        id={intervalFieldId}
        label="Интервал, минут"
        error={state.fieldErrors?.fetchIntervalMinutes}
      >
        <Input
          id={intervalFieldId}
          type="number"
          name="fetchIntervalMinutes"
          min="60"
          max="43200"
          value={fetchIntervalMinutes}
          onChange={(event) => setFetchIntervalMinutes(event.target.value)}
          inputMode="numeric"
          aria-invalid={Boolean(state.fieldErrors?.fetchIntervalMinutes)}
          aria-describedby={fieldDescriptionId(intervalFieldId, state.fieldErrors?.fetchIntervalMinutes)}
        />
      </FormField>
      <FormField id={notesFieldId} label="Внутренние заметки" error={state.fieldErrors?.notes}>
        <Textarea
          id={notesFieldId}
          name="notes"
          maxLength={2000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.notes)}
          aria-describedby={fieldDescriptionId(notesFieldId, state.fieldErrors?.notes)}
        />
      </FormField>
      <ContentIngestionActionMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="save" variant="outline" size="sm" pendingLabel="Сохраняем…">
          Сохранить настройки
        </SubmitButton>
        <SubmitButton name="intent" value="test" variant="secondary" size="sm" pendingLabel="Проверяем…">
          Проверить сейчас
        </SubmitButton>
        <SubmitButton
          name="intent"
          value={source.is_active ? "disable" : "enable"}
          variant={source.is_active ? "outline" : "primary"}
          size="sm"
          pendingLabel={source.is_active ? "Приостанавливаем…" : "Включаем…"}
        >
          {source.is_active ? "Приостановить" : "Включить"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function DomainExclusionForm() {
  const [state, action] = useActionState(
    createContentIngestionDomainExclusionAction,
    initialContentIngestionActionState
  );
  const [domain, setDomain] = useState("");
  return (
    <form action={action} className="space-y-3">
      <FormField
        id="excluded-source-domain"
        label="Исключить домен"
        hint="Импорт остановится также для всех поддоменов. Уже сохранённые данные останутся без изменений."
        error={state.fieldErrors?.domain}
      >
        <Input
          id="excluded-source-domain"
          name="domain"
          inputMode="url"
          placeholder="example.org"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          maxLength={253}
          aria-invalid={Boolean(state.fieldErrors?.domain)}
          aria-describedby={fieldDescriptionId("excluded-source-domain", state.fieldErrors?.domain, true)}
          required
        />
      </FormField>
      <ContentIngestionActionMessage state={state} />
      <SubmitButton variant="outline" pendingLabel="Исключаем…">Исключить домен</SubmitButton>
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
