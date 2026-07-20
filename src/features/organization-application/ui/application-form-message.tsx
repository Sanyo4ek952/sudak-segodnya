import type { ApplicationFormState } from "@/features/organization-application/model/types";

export function ApplicationFormMessage({ state }: { state: ApplicationFormState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p className={state.status === "error" ? "text-sm leading-6 text-error" : "text-sm leading-6 text-success"}>
      {state.message}
    </p>
  );
}
