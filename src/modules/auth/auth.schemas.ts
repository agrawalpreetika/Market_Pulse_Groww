import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(255);

const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(72, "Password cannot exceed 72 characters")
  .refine(
    (password) =>
      new TextEncoder().encode(password).length <= 72,
    "Password cannot exceed 72 UTF-8 bytes",
  );

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = signInSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(120, "Name cannot exceed 120 characters"),
});

export type RegisterInput = z.infer<
  typeof registerSchema
>;