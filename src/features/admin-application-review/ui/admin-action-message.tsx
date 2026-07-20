"use client";

import type { AdminActionState } from "@/features/admin-application-review/model/types";

type AdminActionMessageProps = {
  state: AdminActionState;
};

export function AdminActionMessage({ state }: AdminActionMessageProps) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={
        state.status === "error"
          ? "rounded-md bg-error/10 p-3 text-sm leading-6 text-error"
          : "rounded-md bg-success/10 p-3 text-sm leading-6 text-success"
      }
    >
      {state.message}
    </p>
  );
}
