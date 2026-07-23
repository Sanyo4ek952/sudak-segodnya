"use client";

import { type FormEvent, useActionState, useEffect, useRef, useState } from "react";
import type {
  OrganizationApplication,
  OrganizationType
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
  "typeId",
  "description",
  "address",
  "phone",
  "relationship",
  "confirmationInfo"
];

type ApplicationFormValues = Record<ApplicationFieldName, string>;

function getInitialFormValues(application: OrganizationApplication | null): ApplicationFormValues {
  return {
    organizationName: application?.organization_name ?? "",
    typeId: application?.type_id ?? "",
    description: application?.description ?? "",
    address: application?.address ?? "",
    phone: application?.phone ?? "",
    relationship: application?.relationship ?? "",
    confirmationInfo: application?.confirmation_info ?? ""
  };
}

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

function hasFieldError(
  fieldErrors: Partial<Record<ApplicationFieldName, string>> | undefined,
  fieldName: ApplicationFieldName
) {
  return Boolean(fieldErrors?.[fieldName]);
}

function removeFieldError(
  fieldErrors: Partial<Record<ApplicationFieldName, string>> | undefined,
  fieldName: ApplicationFieldName
) {
  return mergeFieldError(fieldErrors, fieldName, null);
}

function errorState(fieldErrors: Partial<Record<ApplicationFieldName, string>>): ApplicationFormState {
  return {
    status: "error",
    message: "Проверьте отмеченные поля и попробуйте снова.",
    fieldErrors
  };
}

function mergeFieldError(
  fieldErrors: Partial<Record<ApplicationFieldName, string>> | undefined,
  fieldName: ApplicationFieldName,
  error: string | null
) {
  const nextFieldErrors = { ...(fieldErrors ?? {}) };

  if (error) {
    nextFieldErrors[fieldName] = error;
  } else {
    delete nextFieldErrors[fieldName];
  }

  return nextFieldErrors;
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
  categories: OrganizationType[];
  readOnly: boolean;
};

export function OrganizationApplicationForm({
  application,
  categories,
  readOnly
}: OrganizationApplicationFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [formValues, setFormValues] = useState<ApplicationFormValues>(() => getInitialFormValues(application));
  const [clientState, setClientState] = useState<ApplicationFormState>(initialApplicationFormState);
  const [hideServerFieldErrors, setHideServerFieldErrors] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ApplicationFieldName, boolean>>>({});
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
  const selectedType = categories.find((category) => category.id === formValues.typeId);
  const activeState = hasFieldErrors(clientFieldErrors) ? clientState : visibleServerState;
  const rawFieldErrors = activeState.fieldErrors;
  const currentFieldErrors = selectedType
    ? removeFieldError(rawFieldErrors, "typeId")
    : rawFieldErrors;
  const currentState: ApplicationFormState =
    activeState.fieldErrors && !hasFieldErrors(currentFieldErrors)
      ? initialApplicationFormState
      : { ...activeState, fieldErrors: currentFieldErrors };

  function updateFieldValue(fieldName: ApplicationFieldName, value: string) {
    setFormValues((current) => ({ ...current, [fieldName]: value }));
  }

  function showFieldError(fieldName: ApplicationFieldName, value: string) {
    const fieldErrors = mergeFieldError(
      clientState.fieldErrors,
      fieldName,
      validateField(fieldName, value.trim())
    );
    setHideServerFieldErrors(true);
    setTouchedFields((current) => ({ ...current, [fieldName]: true }));
    setClientState(hasFieldErrors(fieldErrors) ? errorState(fieldErrors) : initialApplicationFormState);
  }

  function clearFieldErrorIfValid(fieldName: ApplicationFieldName, value: string) {
    if (
      !touchedFields[fieldName] &&
      !hasFieldError(clientState.fieldErrors, fieldName) &&
      !hasFieldError(serverFieldErrors, fieldName)
    ) {
      return;
    }

    const error = validateField(fieldName, value.trim());

    if (error) {
      return;
    }

    const fieldErrors = mergeFieldError(clientState.fieldErrors, fieldName, null);
    setHideServerFieldErrors(true);
    setClientState(hasFieldErrors(fieldErrors) ? errorState(fieldErrors) : initialApplicationFormState);
  }

  function handleTypeChange(value: string) {
    const fieldErrors = removeFieldError(clientState.fieldErrors, "typeId");

    updateFieldValue("typeId", value);
    setHideServerFieldErrors(true);
    setTouchedFields((current) => ({ ...current, typeId: true }));
    setClientState(hasFieldErrors(fieldErrors) ? errorState(fieldErrors) : initialApplicationFormState);
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    const fieldErrors = validateForm(new FormData(event.currentTarget));

    if (!hasFieldErrors(fieldErrors)) {
      setHideServerFieldErrors(false);
      setClientState(initialApplicationFormState);
      setTouchedFields({});
      return;
    }

    event.preventDefault();
    setHideServerFieldErrors(true);
    setTouchedFields(Object.fromEntries(fieldOrder.map((fieldName) => [fieldName, true])));
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
      onSubmit={handleFormSubmit}
    >
      <input type="hidden" name="applicationId" value={saveState.applicationId ?? application?.id ?? ""} />
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
            value={formValues.organizationName}
            onBlur={(event) => showFieldError("organizationName", event.currentTarget.value)}
            onChange={(event) => {
              const value = event.currentTarget.value;
              updateFieldValue("organizationName", value);
              clearFieldErrorIfValid("organizationName", value);
            }}
          />
        </FormField>
        <FormField
          id="typeId"
          label="Основной тип организации"
          hint="Выберите, чем организация является в первую очередь. Категории событий, акций и объявлений указываются отдельно при создании публикаций."
          error={currentState.fieldErrors?.typeId}
        >
          <Select
            id="typeId"
            name="typeId"
            required
            aria-invalid={Boolean(currentState.fieldErrors?.typeId)}
            aria-describedby={currentState.fieldErrors?.typeId ? "typeId-error" : "typeId-hint"}
            value={formValues.typeId}
            onBlur={(event) => showFieldError("typeId", event.currentTarget.value)}
            onChange={(event) => {
              const value = event.currentTarget.value;
              handleTypeChange(value);
            }}
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
          {selectedType ? (
            <p className="text-sm leading-5 text-success">Выбрано: {selectedType.name}</p>
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
            value={formValues.description}
            onBlur={(event) => showFieldError("description", event.currentTarget.value)}
            onChange={(event) => {
              const value = event.currentTarget.value;
              updateFieldValue("description", value);
              clearFieldErrorIfValid("description", value);
            }}
          />
        </FormField>
        <FormField id="address" label="Адрес" error={currentState.fieldErrors?.address}>
          <Input
            id="address"
            name="address"
            minLength={applicationFieldValidationRules.address.minLength}
            maxLength={applicationFieldValidationRules.address.maxLength}
            aria-invalid={Boolean(currentState.fieldErrors?.address)}
            aria-describedby={currentState.fieldErrors?.address ? "address-error" : undefined}
            value={formValues.address}
            onBlur={(event) => showFieldError("address", event.currentTarget.value)}
            onChange={(event) => {
              const value = event.currentTarget.value;
              updateFieldValue("address", value);
              clearFieldErrorIfValid("address", value);
            }}
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
            value={formValues.phone}
            onBlur={(event) => showFieldError("phone", event.currentTarget.value)}
            onChange={(event) => {
              const value = event.currentTarget.value;
              updateFieldValue("phone", value);
              clearFieldErrorIfValid("phone", value);
            }}
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
            value={formValues.relationship}
            onBlur={(event) => showFieldError("relationship", event.currentTarget.value)}
            onChange={(event) => {
              const value = event.currentTarget.value;
              updateFieldValue("relationship", value);
              clearFieldErrorIfValid("relationship", value);
            }}
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
            value={formValues.confirmationInfo}
            onBlur={(event) => showFieldError("confirmationInfo", event.currentTarget.value)}
            onChange={(event) => {
              const value = event.currentTarget.value;
              updateFieldValue("confirmationInfo", value);
              clearFieldErrorIfValid("confirmationInfo", value);
            }}
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
