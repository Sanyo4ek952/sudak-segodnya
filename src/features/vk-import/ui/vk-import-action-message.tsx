import type { VkImportActionState } from "@/features/vk-import/model/types";

export function VkImportActionMessage({ state }: { state: VkImportActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={state.status === "error" ? "text-sm leading-6 text-error" : "text-sm leading-6 text-success"}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}
