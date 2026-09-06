import {
  compare,
  hash,
} from "bcryptjs";

const PASSWORD_COST = 12;

// Used to reduce timing differences when the email does not exist.
const dummyPasswordHash = hash(
  "marketpulse-invalid-password",
  PASSWORD_COST,
);

export function hashPassword(
  password: string,
): Promise<string> {
  return hash(password, PASSWORD_COST);
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  if (!passwordHash) {
    await compare(
      password,
      await dummyPasswordHash,
    );

    return false;
  }

  return compare(password, passwordHash);
}