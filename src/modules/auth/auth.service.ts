import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";

import { authRepository } from "./auth.repository";
import type { RegisterInput } from "./auth.schemas";
import { hashPassword } from "./password";

export const authService = {
  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();

    const existingUser =
      await authRepository.findUserByEmail(email);

    if (existingUser) {
      throw new AppError(
        "An account with this email already exists",
        "EMAIL_ALREADY_REGISTERED",
        409,
      );
    }

    const passwordHash = await hashPassword(
      input.password,
    );

    try {
      return await authRepository.createUser({
        name: input.name.trim(),
        email,
        passwordHash,
      });
    } catch (error: unknown) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          "An account with this email already exists",
          "EMAIL_ALREADY_REGISTERED",
          409,
        );
      }

      throw error;
    }
  },
};
