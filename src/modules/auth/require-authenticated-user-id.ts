import { AppError } from "@/shared/errors/app-error";

type SessionWithUserId =
  | {
      user?:
        | {
            id?: string | null;
          }
        | null;
    }
  | null
  | undefined;

export function requireAuthenticatedUserId(
  session: SessionWithUserId,
): string {
  const userId = session?.user?.id;

  if (!userId) {
    throw new AppError(
      "Authentication is required",
      "AUTHENTICATION_REQUIRED",
      401,
    );
  }

  return userId;
}
