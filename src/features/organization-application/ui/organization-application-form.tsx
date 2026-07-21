"use client";

import { useActionState } from "react";
import type {
  OrganizationApplication,
  OrganizationCategory
} from "@/entities/organization-application/model/types";
import {
  saveOrganizationApplicationDraftAction,
  submitOrganizationApplicationAction
} from "@/features/organization-application/model/actions";
import { initialApplicationFormState } from "@/features/organization-application/model/types";
import { ApplicationFormMessage } from "@/features/organization-application/ui/application-form-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

type OrganizationApplicationFormProps = {
  application: OrganizationApplication | null;
  categories: OrganizationCategory[];
  readOnly: boolean;
};

export function OrganizationApplicationForm({
  application,
  categories,
  readOnly
}: OrganizationApplicationFormProps) {
  const [saveState, saveAction] = useActionState(
    saveOrganizationApplicationDraftAction,
    initialApplicationFormState
  );
  const [submitState, submitAction] = useActionState(
    submitOrganizationApplicationAction,
    initialApplicationFormState
  );
  const currentState = submitState.message ? submitState : saveState;

  return (
    <form action={saveAction} className="space-y-5">
      <input type="hidden" name="applicationId" value={application?.id ?? ""} />
      <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-80">
        <FormField
          id="organizationName"
          label="Название организации"
          error={currentState.fieldErrors?.organizationName}
        >
          <Input
            id="organizationName"
            name="organizationName"
            required
            defaultValue={application?.organization_name ?? ""}
          />
        </FormField>
        <FormField
          id="categoryId"
          label="Основной тип организации"
          hint="Выберите, чем организация является в первую очередь. Категории событий, акций и объявлений указываются отдельно при создании публикаций."
          error={currentState.fieldErrors?.categoryId}
        >
          <Select id="categoryId" name="categoryId" required defaultValue={application?.category_id ?? ""}>
            <option value="" disabled>
              Выберите категорию
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          id="description"
          label="Краткое описание"
          error={currentState.fieldErrors?.description}
        >
          <Textarea
            id="description"
            name="description"
            required
            defaultValue={application?.description ?? ""}
          />
        </FormField>
        <FormField id="address" label="Адрес" error={currentState.fieldErrors?.address}>
          <Input id="address" name="address" required defaultValue={application?.address ?? ""} />
        </FormField>
        <FormField id="phone" label="Контактный телефон" error={currentState.fieldErrors?.phone}>
          <Input id="phone" name="phone" required defaultValue={application?.phone ?? ""} />
        </FormField>
        <FormField
          id="relationship"
          label="Связь с организацией"
          hint="Например: владелец, управляющий, администратор или ответственный за публикации."
          error={currentState.fieldErrors?.relationship}
        >
          <Textarea
            id="relationship"
            name="relationship"
            required
            defaultValue={application?.relationship ?? ""}
          />
        </FormField>
        <FormField
          id="confirmationInfo"
          label="Подтверждающая информация"
          hint="Можно указать сайт, соцсеть, рабочий email или комментарий для администратора."
          error={currentState.fieldErrors?.confirmationInfo}
        >
          <Textarea
            id="confirmationInfo"
            name="confirmationInfo"
            defaultValue={application?.confirmation_info ?? ""}
          />
        </FormField>
      </fieldset>
      <ApplicationFormMessage state={currentState} />
      {readOnly ? null : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton variant="outline" className="w-full sm:w-auto" pendingLabel="Сохраняем...">
            Сохранить черновик
          </SubmitButton>
          <SubmitButton
            formAction={submitAction}
            className="w-full sm:w-auto"
            pendingLabel="Отправляем..."
          >
            Отправить заявку
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
