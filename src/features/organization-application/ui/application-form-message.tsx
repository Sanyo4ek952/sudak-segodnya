import type { ApplicationFormState } from "@/features/organization-application/model/types";

export function ApplicationFormMessage({ state }: { state: ApplicationFormState }) {
  if (!state.message) {
    return null;
  }

  const fieldErrors = Object.values(state.fieldErrors ?? {});

  return (
    <div className={state.status === "error" ? "text-sm leading-6 text-error" : "text-sm leading-6 text-success"}>
      <p>{state.message}</p>
      {fieldErrors.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {fieldErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
