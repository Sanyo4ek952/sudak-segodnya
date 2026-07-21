import type { AdminActionState } from "@/features/admin-quality-control/model/types";

export function AdminActionMessage({ state }: { state: AdminActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p className={state.status === "error" ? "text-sm text-error" : "text-sm text-success"}>
      {state.message}
    </p>
  );
}
