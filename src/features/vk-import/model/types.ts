export const vkExternalItemStatuses = ["new", "imported", "ignored", "error"] as const;
export type VkExternalItemStatus = (typeof vkExternalItemStatuses)[number];

const vkCommunityHostnames = new Set(["vk.com", "www.vk.com", "vk.ru", "www.vk.ru"]);

export const vkManualImportCooldownMs = 60 * 1000;
export const vkManualImportStaleAfterMs = 5 * 60 * 1000;

export type VkManualImportRunSnapshot = {
  status: "running" | "succeeded" | "partial" | "failed";
  startedAt: string;
  finishedAt: string | null;
};

export type VkImportAvailability = {
  canRun: boolean;
  state: "available" | "running" | "cooldown";
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
  runs: readonly VkManualImportRunSnapshot[],
  nowMs = Date.now()
): VkImportAvailability {
  const lastStartedAt = runs[0]?.startedAt ?? null;
  const running = runs.find((run) => run.status === "running");
  if (running) {
    const startedAtMs = Date.parse(running.startedAt);
    if (!Number.isFinite(startedAtMs)) {
      return {
        canRun: false,
        state: "running",
        lastStartedAt: running.startedAt,
        nextAvailableAt: null
      };
    }

    const staleAtMs = startedAtMs + vkManualImportStaleAfterMs;
    if (nowMs < staleAtMs) {
      return {
        canRun: false,
        state: "running",
        lastStartedAt: running.startedAt,
        nextAvailableAt: new Date(staleAtMs).toISOString()
      };
    }
  }

  const lastCompletedRun = runs
    .filter((run) => run.status === "succeeded" || run.status === "partial")
    .map((run) => ({ run, finishedAtMs: Date.parse(run.finishedAt ?? "") }))
    .filter(({ finishedAtMs }) => Number.isFinite(finishedAtMs))
    .sort((left, right) => right.finishedAtMs - left.finishedAtMs)[0];

  if (lastCompletedRun) {
    const nextAvailableMs = lastCompletedRun.finishedAtMs + vkManualImportCooldownMs;
    if (nowMs < nextAvailableMs) {
      return {
        canRun: false,
        state: "cooldown",
        lastStartedAt: lastCompletedRun.run.startedAt,
        nextAvailableAt: new Date(nextAvailableMs).toISOString()
      };
    }
  }

  return {
    canRun: true,
    state: "available",
    lastStartedAt,
    nextAvailableAt: null
  };
}
