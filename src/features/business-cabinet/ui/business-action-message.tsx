import type { BusinessActionState } from "@/features/business-cabinet/model/types";

export function BusinessActionMessage({ state }: { state: BusinessActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={
        state.status === "success"
          ? "rounded-md bg-success/10 p-3 text-sm leading-6 text-success"
          : "rounded-md bg-error/10 p-3 text-sm leading-6 text-error"
      }
    >
      {state.message}
    </p>
  );
}
