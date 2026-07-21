export type ApplicationFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

export const initialApplicationFormState: ApplicationFormState = {
  status: "idle",
  message: ""
};
