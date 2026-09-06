"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

type CreatedWatchlist = {
  id: string;
  name: string;
  version: number;
  itemCount: number;
};

type Props = {
  onCreated: (watchlist: CreatedWatchlist) => void;
};

export function CreateWatchlistForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitting = useRef(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting.current) {
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Enter a watchlist name.");
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/watchlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      const result = (await response.json()) as {
        data?: CreatedWatchlist;
        error?: {
          message?: string;
        };
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error?.message ??
            "Could not create the watchlist.",
        );
      }

      setName("");
      onCreated(result.data);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the watchlist.",
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 border-t border-slate-800 pt-5"
      aria-busy={isSubmitting}
    >
      <label
        htmlFor="new-watchlist-name"
        className="block text-sm font-medium text-slate-300"
      >
        Create a watchlist
      </label>

      <input
        id="new-watchlist-name"
        name="watchlistName"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        placeholder="e.g. Long-term picks"
        maxLength={80}
        required
        disabled={isSubmitting}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? "create-watchlist-error" : undefined
        }
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 disabled:opacity-50"
      />

      {error ? (
        <p
          id="create-watchlist-error"
          role="alert"
          className="mt-2 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !name.trim()}
        className="mt-3 w-full rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Creating…" : "Create watchlist"}
      </button>
    </form>
  );
}