export const vkFallbackImagePath = "/brand/vk-import-fallback.png";
export const vkImportMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

export type VkQueueMedia = {
  kind: "photo" | "video_preview";
  sourceUrl: string;
  signedUrl: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
};
