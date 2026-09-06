import { auth } from "@/auth";
import { prisma } from "@/infrastructure/database/prisma";
import { AppError } from "@/shared/errors/app-error";

import { requireAuthenticatedUserId } from "./require-authenticated-user-id";

export async function getCurrentUser() {
  const session = await auth();
  const userId = requireAuthenticatedUserId(session);

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(
      "The authenticated user no longer exists",
      "AUTHENTICATED_USER_NOT_FOUND",
      401,
    );
  }

  return user;
}
