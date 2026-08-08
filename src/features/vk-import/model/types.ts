export const vkExternalItemStatuses = ["new", "imported", "ignored", "error"] as const;
export type VkExternalItemStatus = (typeof vkExternalItemStatuses)[number];

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
