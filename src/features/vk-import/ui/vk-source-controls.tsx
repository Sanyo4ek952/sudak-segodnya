"use client";

import { useActionState, useState } from "react";
import {
  createVkSourceAction,
  runVkImportNowAction,
  updateVkSourceAction
} from "@/features/vk-import/model/actions";
import { initialVkImportActionState } from "@/features/vk-import/model/types";
import { VkImportActionMessage } from "@/features/vk-import/ui/vk-import-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";

type OrganizationOption = { id: string; name: string };

type VkSourceSettings = {
  id: string;
  name: string;
  organization_id: string | null;
  is_active: boolean;
};

export function CreateVkSourceForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, action] = useActionState(createVkSourceAction, initialVkImportActionState);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [isActive, setIsActive] = useState(true);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <FormField id="vk-source-domain" label="Domain сообщества" error={state.fieldErrors?.domain}>
        <Input
          id="vk-source-domain"
          name="domain"
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="sudak_today"
          aria-invalid={Boolean(state.fieldErrors?.domain)}
          aria-describedby={state.fieldErrors?.domain ? "vk-source-domain-error" : undefined}
          required
        />
      </FormField>
      <FormField id="vk-source-name" label="Название">
        <Input
          id="vk-source-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={180}
          required
        />
      </FormField>
      <div className="sm:col-span-2">
        <FormField
          id="vk-source-organization"
          label="Организация"
          hint="Если сообщество относится к одной организации, она будет предзаполнена при модерации."
        >
          <Select
            id="vk-source-organization"
            name="organizationId"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
          >
            <option value="">Не привязывать заранее</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium sm:col-span-2">
        <input
          type="checkbox"
          name="isActive"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        Включить импорт сразу
      </label>
      <div className="sm:col-span-2"><VkImportActionMessage state={state} /></div>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Добавляем…">Добавить источник</SubmitButton>
      </div>
    </form>
  );
}

export function VkSourceSettingsForm({
  source,
  organizations
}: {
  source: VkSourceSettings;
  organizations: OrganizationOption[];
}) {
  const [state, action] = useActionState(updateVkSourceAction, initialVkImportActionState);
  const [name, setName] = useState(source.name);
  const [organizationId, setOrganizationId] = useState(source.organization_id ?? "");
  const nameId = `vk-source-name-${source.id}`;
  const organizationIdField = `vk-source-organization-${source.id}`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sourceId" value={source.id} />
      <FormField id={nameId} label="Название">
        <Input
          id={nameId}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={180}
          required
        />
      </FormField>
      <FormField id={organizationIdField} label="Организация">
        <Select
          id={organizationIdField}
          name="organizationId"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        >
          <option value="">Не привязывать заранее</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>{organization.name}</option>
          ))}
        </Select>
      </FormField>
      <VkImportActionMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="save" size="sm" variant="outline" pendingLabel="Сохраняем…">
          Сохранить
        </SubmitButton>
        <SubmitButton
          name="intent"
          value="toggle"
          size="sm"
          variant={source.is_active ? "outline" : "primary"}
          pendingLabel={source.is_active ? "Приостанавливаем…" : "Включаем…"}
        >
          {source.is_active ? "Приостановить" : "Включить"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function RunVkImportForm() {
  const [state, action] = useActionState(runVkImportNowAction, initialVkImportActionState);
  return (
    <form action={action} className="space-y-2">
      <VkImportActionMessage state={state} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Синхронизируем…">
        Синхронизировать
      </SubmitButton>
    </form>
  );
}
