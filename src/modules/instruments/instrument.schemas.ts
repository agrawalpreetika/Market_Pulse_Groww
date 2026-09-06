import { z } from "zod";

export const searchInstrumentsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Search query is required")
    .max(50, "Search query cannot exceed 50 characters"),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(25)
    .default(10),
});

export type SearchInstrumentsInput = z.infer<
  typeof searchInstrumentsSchema
  >;

export const instrumentHistorySchema = z.object({
  range: z
    .enum(["1D", "1W", "1M", "3M"])
    .default("1W"),
});

export type InstrumentHistoryInput = z.infer<
  typeof instrumentHistorySchema
>;