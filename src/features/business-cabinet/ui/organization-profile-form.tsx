"use client";

import { useActionState } from "react";
import { updateOrganizationProfileAction } from "@/features/business-cabinet/model/actions";
import { initialBusinessActionState } from "@/features/business-cabinet/model/types";
import type { BusinessOrganization } from "@/features/business-cabinet/model/types";
import { BusinessActionMessage } from "@/features/business-cabinet/ui/business-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

export function OrganizationProfileForm({ organization }: { organization: BusinessOrganization }) {
  const [state, action] = useActionState(updateOrganizationProfileAction, initialBusinessActionState);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="organizationId" value={organization.id} />
      <FormField id="name" label="Название">
        <Input id="name" name="name" required defaultValue={organization.name} />
      </FormField>
      <FormField id="description" label="Описание">
        <Textarea id="description" name="description" required defaultValue={organization.description ?? ""} />
      </FormField>
      <FormField id="address" label="Адрес">
        <Input id="address" name="address" required defaultValue={organization.address ?? ""} />
      </FormField>
      <FormField id="phone" label="Телефон">
        <Input id="phone" name="phone" required defaultValue={organization.phone ?? ""} />
      </FormField>
      <FormField id="workingHours" label="График работы">
        <Textarea id="workingHours" name="workingHours" defaultValue={organization.working_hours ?? ""} />
      </FormField>
      <BusinessActionMessage state={state} />
      <SubmitButton pendingLabel="Сохраняем...">Сохранить профиль</SubmitButton>
    </form>
  );
}
