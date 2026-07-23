import { z } from "zod";
import { postgresUuidSchema } from "@/shared/lib/postgres-uuid";

export const favoriteIdsSchema = z.object({
  publicationIds: z.array(postgresUuidSchema).max(100),
  organizationIds: z.array(postgresUuidSchema).max(100)
});
