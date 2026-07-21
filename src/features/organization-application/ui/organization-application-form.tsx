"use client";

import { type FormEvent, useActionState, useEffect, useRef, useState } from "react";
import type {
  OrganizationApplication,
  OrganizationCategory
} from "@/entities/organization-application/model/types";
import {
  saveOrganizationApplicationDraftAction,
  submitOrganizationApplicationAction
} from "@/features/organization-application/model/actions";
import {
  applicationFieldErrorMessages,
  applicationFieldValidationRules,
  initialApplicationFormState,
  type ApplicationFieldName,
  type ApplicationFormState
} from "@/features/organization-application/model/types";
import { ApplicationFormMessage } from "@/features/organization-application/ui/application-form-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

const fieldOrder: ApplicationFieldName[] = [
  "organizationName",
  "categoryId",
  "description",
  "address",
  "phone",
  "relationship",
  "confirmationInfo"
];

function getFormValue(formData: FormData, fieldName: ApplicationFieldName) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function validateField(fieldName: ApplicationFieldName, value: string) {
  const rules = applicationFieldValidationRules[fieldName];

  if (rules.required && !value) {
    return applicationFieldErrorMessages[fieldName];
  }

  if (!value && !rules.required) {
    return null;
  }

  if ("minLength" in rules && value.length < rules.minLength) {
    return applicationFieldErrorMessages[fieldName];
  }

  if ("maxLength" in rules && value.length > rules.maxLength) {
    return applicationFieldErrorMessages[fieldName];
  }

  return null;
}

function validateForm(formData: FormData) {
  const fieldErrors: Partial<Record<ApplicationFieldName, string>> = {};

  for (const fieldName of fieldOrder) {
    const error = validateField(fieldName, getFormValue(formData, fieldName));

    if (error) {
      fieldErrors[fieldName] = error;
    }
  }

  return fieldErrors;
}

function hasFieldErrors(fieldErrors?: Partial<Record<ApplicationFieldName, string>>) {
  return Boolean(fieldErrors && Object.keys(fieldErrors).length > 0);
}

function errorState(fieldErrors: Partial<Record<ApplicationFieldName, string>>): ApplicationFormState {
  return {
    status: "error",
    message: "Проверьте отмеченные поля и попробуйте снова.",
    fieldErrors
  };
}

function focusFirstError(fieldErrors?: Partial<Record<ApplicationFieldName, string>>) {
  const firstFieldName = fieldOrder.find((fieldName) => fieldErrors?.[fieldName]);

  if (!firstFieldName) {
    return;
  }

  document.getElementById(firstFieldName)?.focus();
}

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
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(application?.category_id ?? "");
  const [clientState, setClientState] = useState<ApplicationFormState>(initialApplicationFormState);
  const [hideServerFieldErrors, setHideServerFieldErrors] = useState(false);
  const [saveState, saveAction] = useActionState(
    saveOrganizationApplicationDraftAction,
    initialApplicationFormState
  );
  const [submitState, submitAction] = useActionState(
    submitOrganizationApplicationAction,
    initialApplicationFormState
  );
  const serverState = submitState.message ? submitState : saveState;
  const visibleServerState = hideServerFieldErrors ? initialApplicationFormState : serverState;
  const serverFieldErrors = visibleServerState.fieldErrors;
  const clientFieldErrors = clientState.fieldErrors;
  const currentFieldErrors = hasFieldErrors(clientFieldErrors) ? clientFieldErrors : serverFieldErrors;
  const currentState: ApplicationFormState = hasFieldErrors(clientFieldErrors)
    ? clientState
    : { ...visibleServerState, fieldErrors: currentFieldErrors };
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  function validateCurrentForm() {
    if (!formRef.current) {
      return {};
    }

    return validateForm(new FormData(formRef.current));
  }

  function handleFormInput() {
    const fieldErrors = validateCurrentForm();
    setHideServerFieldErrors(true);
    setClientState(hasFieldErrors(fieldErrors) ? errorState(fieldErrors) : initialApplicationFormState);
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    const fieldErrors = validateForm(new FormData(event.currentTarget));

    if (!hasFieldErrors(fieldErrors)) {
      setHideServerFieldErrors(false);
      setClientState(initialApplicationFormState);
      return;
    }

    event.preventDefault();
    setHideServerFieldErrors(true);
    setClientState(errorState(fieldErrors));
    focusFirstError(fieldErrors);
  }

  useEffect(() => {
    if (!hideServerFieldErrors && serverState.status === "error" && hasFieldErrors(serverState.fieldErrors)) {
      focusFirstError(serverState.fieldErrors);
    }
  }, [hideServerFieldErrors, serverState]);

  return (
    <form
      ref={formRef}
      action={saveAction}
      className="space-y-5"
      noValidate
      onBlur={handleFormInput}
      onInput={handleFormInput}
      onChange={handleFormInput}
      onSubmit={handleFormSubmit}
    >
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
            minLength={applicationFieldValidationRules.organizationName.minLength}
            maxLength={applicationFieldValidationRules.organizationName.maxLength}
            aria-invalid={Boolean(currentState.fieldErrors?.organizationName)}
            aria-describedby={currentState.fieldErrors?.organizationName ? "organizationName-error" : undefined}
            defaultValue={application?.organization_name ?? ""}
          />
        </FormField>
        <FormField
          id="categoryId"
          label="Основной тип организации"
          hint="Выберите, чем организация является в первую очередь. Категории событий, акций и объявлений указываются отдельно при создании публикаций."
          error={currentState.fieldErrors?.categoryId}
        >
          <Select
            id="categoryId"
            name="categoryId"
            required
            aria-invalid={Boolean(currentState.fieldErrors?.categoryId)}
            aria-describedby={currentState.fieldErrors?.categoryId ? "categoryId-error" : "categoryId-hint"}
            value={selectedCategoryId}
            onChange={(event) => setSelectedCategoryId(event.currentTarget.value)}
          >
            <option value="" disabled>
              Выберите категорию
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          {selectedCategory ? (
            <p className="text-sm leading-5 text-success">Выбрано: {selectedCategory.name}</p>
          ) : null}
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
            minLength={applicationFieldValidationRules.description.minLength}
            maxLength={applicationFieldValidationRules.description.maxLength}
            aria-invalid={Boolean(currentState.fieldErrors?.description)}
            aria-describedby={currentState.fieldErrors?.description ? "description-error" : undefined}
            defaultValue={application?.description ?? ""}
          />
        </FormField>
        <FormField id="address" label="Адрес" error={currentState.fieldErrors?.address}>
          <Input
            id="address"
            name="address"
            required
            minLength={applicationFieldValidationRules.address.minLength}
            maxLength={applicationFieldValidationRules.address.maxLength}
            aria-invalid={Boolean(currentState.fieldErrors?.address)}
            aria-describedby={currentState.fieldErrors?.address ? "address-error" : undefined}
            defaultValue={application?.address ?? ""}
          />
        </FormField>
        <FormField id="phone" label="Контактный телефон" error={currentState.fieldErrors?.phone}>
          <Input
            id="phone"
            name="phone"
            required
            minLength={applicationFieldValidationRules.phone.minLength}
            maxLength={applicationFieldValidationRules.phone.maxLength}
            aria-invalid={Boolean(currentState.fieldErrors?.phone)}
            aria-describedby={currentState.fieldErrors?.phone ? "phone-error" : undefined}
            defaultValue={application?.phone ?? ""}
          />
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
            minLength={applicationFieldValidationRules.relationship.minLength}
            maxLength={applicationFieldValidationRules.relationship.maxLength}
            aria-invalid={Boolean(currentState.fieldErrors?.relationship)}
            aria-describedby={currentState.fieldErrors?.relationship ? "relationship-error" : "relationship-hint"}
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
            maxLength={applicationFieldValidationRules.confirmationInfo.maxLength}
            aria-invalid={Boolean(currentState.fieldErrors?.confirmationInfo)}
            aria-describedby={
              currentState.fieldErrors?.confirmationInfo ? "confirmationInfo-error" : "confirmationInfo-hint"
            }
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
