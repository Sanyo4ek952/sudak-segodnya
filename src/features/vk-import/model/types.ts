export const vkExternalItemStatuses = ["new", "imported", "ignored", "error"] as const;
export type VkExternalItemStatus = (typeof vkExternalItemStatuses)[number];

export const vkManualImportCooldownMs = 24 * 60 * 60 * 1000;

export type VkImportAvailability = {
  canRun: boolean;
  lastStartedAt: string | null;
  nextAvailableAt: string | null;
};

export const vkExternalItemStatusLabels: Record<VkExternalItemStatus, string> = {
  new: "Новый",
  imported: "Импортирован",
  ignored: "Игнорирован",
  error: "Ошибка"
};

export type VkImportActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

export const initialVkImportActionState: VkImportActionState = {
  status: "idle",
  message: ""
};

export function parseVkExternalItemStatus(value: unknown): VkExternalItemStatus {
  return typeof value === "string" && vkExternalItemStatuses.includes(value as VkExternalItemStatus)
    ? value as VkExternalItemStatus
    : "new";
}

export function getVkImportAvailability(
  lastStartedAt: string | null,
  nowMs = Date.now()
): VkImportAvailability {
  if (!lastStartedAt) {
    return { canRun: true, lastStartedAt: null, nextAvailableAt: null };
  }

  const lastStartedMs = Date.parse(lastStartedAt);
  if (!Number.isFinite(lastStartedMs)) {
    return { canRun: false, lastStartedAt, nextAvailableAt: null };
  }

  const nextAvailableMs = lastStartedMs + vkManualImportCooldownMs;
  return {
    canRun: nowMs >= nextAvailableMs,
    lastStartedAt,
    nextAvailableAt: new Date(nextAvailableMs).toISOString()
  };
}
