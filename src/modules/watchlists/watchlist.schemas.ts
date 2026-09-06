import { z } from "zod";

export const createWatchlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Watchlist name is required")
    .max(80, "Watchlist name cannot exceed 80 characters"),
});

export type CreateWatchlistInput = z.infer<
  typeof createWatchlistSchema
  >;


export const updateWatchlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Watchlist name is required")
    .max(80, "Watchlist name cannot exceed 80 characters"),

  version: z
    .number()
    .int()
    .positive("Version must be a positive integer"),
});

export type UpdateWatchlistInput = z.infer<
  typeof updateWatchlistSchema
  >;


  const watchlistItemOptions = {
  userNote: z
    .string()
    .trim()
    .max(500, "Note cannot exceed 500 characters")
    .optional(),

  customThreshold: z
    .number()
    .positive("Threshold must be greater than zero")
    .max(100, "Threshold cannot exceed 100 percent")
    .optional(),
};

const addCatalogInstrumentSchema = z.object({
  source: z.literal("CATALOG").optional(),

  instrumentId: z
    .string()
    .uuid("Instrument ID must be a valid UUID"),

  ...watchlistItemOptions,
});

const addYahooInstrumentSchema = z.object({
  source: z.literal("YAHOO"),

  providerIdentifier: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9&._-]+\.(NS|BO)$/,
      "Yahoo instrument identifier must belong to NSE or BSE",
    ),

  ...watchlistItemOptions,
});

export const addWatchlistItemSchema = z.union([
  addCatalogInstrumentSchema,
  addYahooInstrumentSchema,
]);

export type AddWatchlistItemInput = z.infer<
  typeof addWatchlistItemSchema
>;