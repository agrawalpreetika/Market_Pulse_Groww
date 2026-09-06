"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

type WatchlistIdentity = {
  id: string;
  name: string;
  version: number;
};

type Props = {
  watchlist: WatchlistIdentity;
  onRenamed: (watchlist: WatchlistIdentity) => void;
  onDeleted: (watchlistId: string) => void;
};

export function WatchlistActions({
  watchlist,
  onRenamed,
  onDeleted,
}: Props) {
  const [mode, setMode] =
    useState<"idle" | "rename" | "delete">("idle");

  const [name, setName] = useState(watchlist.name);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending.current || !name.trim()) {
      return;
    }

    pending.current = true;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/watchlists/${watchlist.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            version: watchlist.version,
          }),
        },
      );

      const result = (await response.json()) as {
        data?: WatchlistIdentity;
        error?: { message?: string };
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error?.message ?? "Could not rename watchlist.",
        );
      }

      onRenamed(result.data);
      setMode("idle");
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not rename watchlist.",
      );
    } finally {
      pending.current = false;
      setIsPending(false);
    }
  }

  async function deleteWatchlist() {
    if (
      pending.current ||
      confirmation !== watchlist.name
    ) {
      return;
    }

    pending.current = true;
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/watchlists/${watchlist.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const result = (await response.json()) as {
          error?: { message?: string };
        };

        throw new Error(
          result.error?.message ?? "Could not delete watchlist.",
        );
      }

      onDeleted(watchlist.id);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not delete watchlist.",
      );
    } finally {
      pending.current = false;
      setIsPending(false);
    }
  }

  function cancel() {
    setMode("idle");
    setError(null);
    setConfirmation("");
  }

  return (
    <div className="mb-6">
      {mode === "idle" ? (
        <div className="flex gap-4 text-sm">
          <button
            type="button"
            onClick={() => {
              setName(watchlist.name);
              setError(null);
              setMode("rename");
            }}
            className="text-slate-300 hover:text-cyan-300"
          >
            Rename watchlist
          </button>

          <button
            type="button"
            onClick={() => {
              setConfirmation("");
              setError(null);
              setMode("delete");
            }}
            className="text-red-300 hover:text-red-200"
          >
            Delete watchlist
          </button>
        </div>
      ) : null}

      {mode === "rename" ? (
        <form
          onSubmit={rename}
          className="rounded-xl border border-slate-700 p-4"
        >
          <label
            htmlFor="rename-watchlist"
            className="block text-sm text-slate-300"
          >
            Watchlist name
          </label>

          <input
            id="rename-watchlist"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            disabled={isPending}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />

          <div className="mt-3 flex gap-4 text-sm">
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="text-cyan-300 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save name"}
            </button>

            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="text-slate-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {mode === "delete" ? (
        <div className="rounded-xl border border-red-900 p-4">
          <h3 className="font-medium text-red-200">
            Delete {watchlist.name}?
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            This permanently deletes the watchlist, its stock
            memberships, and its review history. It cannot be
            undone in the app.
          </p>

          <label
            htmlFor="delete-watchlist-confirmation"
            className="mt-3 block text-sm text-slate-300"
          >
            Type “{watchlist.name}” to confirm
          </label>

          <input
            id="delete-watchlist-confirmation"
            value={confirmation}
            onChange={(event) =>
              setConfirmation(event.target.value)
            }
            disabled={isPending}
            autoComplete="off"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />

          <div className="mt-3 flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => void deleteWatchlist()}
              disabled={
                isPending ||
                confirmation !== watchlist.name
              }
              className="text-red-300 disabled:opacity-40"
            >
              {isPending ? "Deleting…" : "Permanently delete"}
            </button>

            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
