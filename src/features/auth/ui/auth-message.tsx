import type { AuthFormState } from "@/features/auth/model/types";

export function AuthMessage({ state }: { state: AuthFormState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p className={state.status === "error" ? "text-sm leading-6 text-error" : "text-sm leading-6 text-success"}>
      {state.message}
    </p>
  );
}
