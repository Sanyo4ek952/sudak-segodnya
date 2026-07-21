export const applicationFieldErrorMessages = {
  organizationName: "Укажите название организации: минимум 2 символа.",
  categoryId: "Выберите основной тип организации из списка.",
  description: "Добавьте краткое описание: минимум 10 символов.",
  address: "Укажите адрес: минимум 3 символа.",
  phone: "Укажите контактный телефон: минимум 5 символов.",
  relationship: "Укажите вашу связь с организацией: минимум 3 символа.",
  confirmationInfo: "Подтверждающая информация должна быть не длиннее 2000 символов."
} as const;

export const applicationFieldValidationRules = {
  organizationName: { minLength: 2, maxLength: 160, required: true },
  categoryId: { required: true },
  description: { minLength: 10, maxLength: 2000, required: true },
  address: { minLength: 3, maxLength: 300, required: true },
  phone: { minLength: 5, maxLength: 80, required: true },
  relationship: { minLength: 3, maxLength: 500, required: true },
  confirmationInfo: { maxLength: 2000, required: false }
} as const;

export type ApplicationFieldName = keyof typeof applicationFieldErrorMessages;

export type ApplicationFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<ApplicationFieldName, string>>;
};

export const initialApplicationFormState: ApplicationFormState = {
  status: "idle",
  message: ""
};
