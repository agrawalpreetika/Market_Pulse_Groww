import assert from "node:assert/strict";
import { test } from "node:test";

import {
  registerSchema,
  signInSchema,
} from "../src/modules/auth/auth.schemas";
import {
  hashPassword,
  verifyPassword,
} from "../src/modules/auth/password";
import { requireAuthenticatedUserId } from "../src/modules/auth/require-authenticated-user-id";
import { AppError } from "../src/shared/errors/app-error";

test("protected operations reject missing authentication", () => {
  assert.throws(
    () => requireAuthenticatedUserId(null),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "AUTHENTICATION_REQUIRED");
      assert.equal(error.statusCode, 401);
      return true;
    },
  );
});

test("protected operations use the authenticated user id", () => {
  assert.equal(
    requireAuthenticatedUserId({
      user: {
        id: "user-a",
      },
    }),
    "user-a",
  );
});

test("authentication schemas normalize email addresses", () => {
  const result = registerSchema.parse({
    name: "  Test User  ",
    email: "  TEST@EXAMPLE.COM  ",
    password: "StrongPassword123",
  });

  assert.equal(result.name, "Test User");
  assert.equal(result.email, "test@example.com");
});

test("authentication schemas reject weak or invalid input", () => {
  assert.equal(
    signInSchema.safeParse({
      email: "invalid",
      password: "short",
    }).success,
    false,
  );

  assert.equal(
    registerSchema.safeParse({
      name: "A",
      email: "test@example.com",
      password: "StrongPassword123",
    }).success,
    false,
  );
});

test("passwords are hashed and verified without storing plaintext", async () => {
  const password = "StrongPassword123";
  const passwordHash = await hashPassword(password);

  assert.notEqual(passwordHash, password);
  assert.equal(
    await verifyPassword(password, passwordHash),
    true,
  );
  assert.equal(
    await verifyPassword("WrongPassword123", passwordHash),
    false,
  );
});

test("a missing password hash never authenticates", async () => {
  assert.equal(
    await verifyPassword("StrongPassword123", null),
    false,
  );
});
