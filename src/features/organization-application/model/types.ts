export type ApplicationFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialApplicationFormState: ApplicationFormState = {
  status: "idle",
  message: ""
};
