import type { ContentIngestionActionState } from "@/features/content-ingestion/model/types";

export function ContentIngestionActionMessage({ state }: { state: ContentIngestionActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      aria-live={state.status === "error" ? "assertive" : "polite"}
      className={state.status === "error" ? "text-sm text-error" : "text-sm text-success"}
    >
      {state.message}
    </p>
  );
}
