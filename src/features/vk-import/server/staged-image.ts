import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createSupabaseAdminClient } from "@/shared/api/supabase/admin";

export type VkStagedCandidateMedia = {
  bucketId: string;
  storagePath: string;
  sourceUrl: string;
  kind: "photo" | "video_preview";
  sortOrder: number;
};

export async function getVkStagedCandidateMedia(candidateId: string) {
  const admin = createSupabaseAdminClient();
  const { data: item, error: itemError } = await admin
    .from("external_items")
    .select("id")
    .eq("content_candidate_id", candidateId)
    .maybeSingle();
  if (itemError) throw new Error("Не удалось проверить происхождение изображения.");
  if (!item) return { isVkCandidate: false as const, media: [] as VkStagedCandidateMedia[] };

  const { data, error } = await admin
    .from("external_item_media")
    .select("bucket_id, storage_path, source_url, kind, sort_order")
    .eq("external_item_id", item.id)
    .order("sort_order")
    .order("id");
  if (error) throw new Error("Не удалось загрузить сохранённые VK-медиа.");

  const media = (data ?? []).flatMap((row) => (
    (row.kind === "photo" || row.kind === "video_preview")
      ? [{
          bucketId: row.bucket_id,
          storagePath: row.storage_path,
          sourceUrl: row.source_url,
          kind: row.kind,
          sortOrder: row.sort_order
        }]
      : []
  ));
  return { isVkCandidate: true as const, media };
}

export async function readVkFallbackImage() {
  return readFile(join(process.cwd(), "public", "brand", "vk-import-fallback.png"));
}
