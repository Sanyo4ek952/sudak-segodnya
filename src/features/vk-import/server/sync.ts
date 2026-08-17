import "server-only";

import { z } from "zod";

const sourceResultSchema = z.object({
  sourceId: z.string().uuid(),
  status: z.enum(["succeeded", "failed"]),
  discoveredCount: z.number().int().nonnegative(),
  insertedCount: z.number().int().nonnegative(),
  savedMediaCount: z.number().int().nonnegative().default(0),
  failedMediaCount: z.number().int().nonnegative().default(0),
  error: z.string().nullable()
});

const vkImportResultSchema = z.object({
  sourceCount: z.number().int().nonnegative(),
  succeededCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  discoveredCount: z.number().int().nonnegative(),
  insertedCount: z.number().int().nonnegative(),
  savedMediaCount: z.number().int().nonnegative().default(0),
  failedMediaCount: z.number().int().nonnegative().default(0),
  results: z.array(sourceResultSchema)
});

export type VkImportResult = z.infer<typeof vkImportResultSchema>;

export async function invokeVkImport(): Promise<VkImportResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const internalSecret = process.env.VK_IMPORT_INTERNAL_SECRET?.trim();
  if (!supabaseUrl || !anonKey || !internalSecret) {
    throw new Error("VK import server credentials are not configured.");
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/vk-import`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${internalSecret}`,
        "content-type": "application/json"
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(240_000)
    });
  } catch {
    throw new Error("VK import function is unavailable.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("VK import function returned an invalid response.");
  }
  if (!response.ok) throw new Error("VK import function rejected the request.");

  const parsed = vkImportResultSchema.safeParse(payload);
  if (!parsed.success) throw new Error("VK import function returned an invalid result.");
  return parsed.data;
}
