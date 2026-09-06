"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import type { FormEvent } from "react";

type RegistrationResponse = {
  data?: {
    id: string;
    email: string;
  };
  error?: {
    message?: string;
    details?: Array<{
      path: string;
      message: string;
    }>;
  };
};

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const result =
        (await response.json()) as RegistrationResponse;

      if (!response.ok || !result.data) {
        const validationMessage =
          result.error?.details?.[0]?.message;

        throw new Error(
          validationMessage ??
            result.error?.message ??
            "Registration failed.",
        );
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!signInResult || signInResult.error) {
        router.push("/login");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Registration is temporarily unavailable.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm font-semibold text-cyan-400">
          MARKETPULSE
        </p>

        <h1 className="mt-2 text-3xl font-semibold">
          Create your account
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Your watchlists will be available across authenticated
          sessions.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>

            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="text-sm font-medium"
            >
              Email
            </label>

            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="text-sm font-medium"
            >
              Password
            </label>

            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-400"
            />

            <p className="mt-2 text-xs text-slate-500">
              Use at least eight characters.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-400/10 p-3 text-sm text-red-300"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? "Creating account…"
              : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-cyan-300 underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
