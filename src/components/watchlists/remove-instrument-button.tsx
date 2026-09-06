"use client";

import { useRef, useState } from "react";

type Props = {
  watchlistId: string;
  instrumentId: string;
  symbol: string;
  onRemoved: (
    watchlistId: string,
    instrumentId: string,
  ) => void;
};

export function RemoveInstrumentButton({
  watchlistId,
  instrumentId,
  symbol,
  onRemoved,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function remove() {
    if (pending.current) {
      return;
    }

    pending.current = true;
    setIsRemoving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/watchlists/${watchlistId}/items/${instrumentId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const result = (await response.json()) as {
          error?: { message?: string };
        };

        throw new Error(
          result.error?.message ??
            "Could not remove this instrument.",
        );
      }

      // A successful DELETE returns 204 with no JSON body.
      onRemoved(watchlistId, instrumentId);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not remove this instrument.",
      );
    } finally {
      pending.current = false;
      setIsRemoving(false);
    }
  }

  return (
    <div className="mt-3">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${symbol} from this watchlist`}
          className="text-xs text-slate-500 underline underline-offset-4 hover:text-red-300"
        >
          Remove
        </button>
      ) : (
        <div>
          <p className="text-xs text-slate-400">
            Remove {symbol} from this watchlist?
          </p>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => void remove()}
              disabled={isRemoving}
              className="text-xs font-medium text-red-300 disabled:opacity-50"
            >
              {isRemoving ? "Removing…" : "Confirm removal"}
            </button>

            <button
              type="button"
              disabled={isRemoving}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              className="text-xs text-slate-400 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}