import { z } from "zod";

export const acknowledgeReviewSchema = z.object({
  version: z.number().int().positive(),
});

export type AcknowledgeReviewInput = z.infer<
  typeof acknowledgeReviewSchema
>;