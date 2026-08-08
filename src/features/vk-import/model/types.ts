export const vkExternalItemStatuses = ["new", "imported", "ignored", "error"] as const;
export type VkExternalItemStatus = (typeof vkExternalItemStatuses)[number];

const vkCommunityHostnames = new Set(["vk.com", "www.vk.com", "vk.ru", "www.vk.ru"]);

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

export function normalizeVkDomain(rawValue: string) {
  let value = rawValue.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!vkCommunityHostnames.has(url.hostname.toLowerCase())) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length !== 1 || url.search || url.hash) return null;
      value = parts[0];
    } catch {
      return null;
    }
  }
  value = value.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_.-]{2,100}$/.test(value) ? value : null;
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
