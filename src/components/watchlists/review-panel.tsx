"use client";

import { useEffect, useState } from "react";
import { PriceHistoryChart } from "./price-history-chart";
import { ReviewSummary } from "./review-summary";

type Review = {
  id: string;
  version: number;
  status: "OPEN" | "ACKNOWLEDGED" | "SUPERSEDED";
};

type AttentionLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";

type Change = {
  instrument: {
    id: string;
    symbol: string;
    name: string;
    currency: string;
  };
  current: {
  price: string | null;
  providerTimestamp: string | null;
  quoteSource: string | null;
};
  baseline: {
  price: string | null;
  providerTimestamp: string | null;
  quoteSource: string | null;
} | null;
  attentionLevel: AttentionLevel;
  priceChangePercent: number | null;
  reasons: string[];
  dataStatus: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  warnings: string[];
};

type Comparison = {
  reviewId: string;
  baselineReviewId: string | null;
  snapshotAt: string;
  baselineSnapshotAt: string | null;
  summary: {
    high: number;
    medium: number;
    low: number;
    none: number;
    total: number;
    unavailable: number;
  };
  changes: Change[];
  message?: string;
};

type Props = {
  watchlistId: string;
};

const badgeStyles: Record<AttentionLevel, string> = {
  HIGH: "bg-amber-400/15 text-amber-300",
  MEDIUM: "bg-blue-400/15 text-blue-300",
  LOW: "bg-slate-700 text-slate-300",
  NONE: "bg-slate-800 text-slate-400",
};

function formatPrice(
  value: string | null,
  currency: string,
) {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readData<T>(
  response: Response,
): Promise<T> {
  const result = (await response.json()) as {
    data?: T;
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(
      result.error?.message ?? "The request failed",
    );
  }

  if (result.data === undefined) {
    throw new Error("The server returned an unexpected response");
  }

  return result.data;
}

export function ReviewPanel({ watchlistId }: Props) {
  const [review, setReview] = useState<Review | null>(null);
  const [comparison, setComparison] =
    useState<Comparison | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isAcknowledging, setIsAcknowledging] =
    useState(false);

  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadReview() {
      try {
        const reviewResponse = await fetch(
          `/api/watchlists/${watchlistId}/reviews`,
          {
            method: "POST",
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const loadedReview =
          await readData<Review>(reviewResponse);

        const changesResponse = await fetch(
          `/api/watchlists/${watchlistId}/reviews/${loadedReview.id}/changes`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const loadedComparison =
          await readData<Comparison>(changesResponse);

        if (!active) {
          return;
        }

        setReview(loadedReview);
        setComparison(loadedComparison);
      } catch (cause: unknown) {
        if (!active || controller.signal.aborted) {
          return;
        }

        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load your review",
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadReview();

    return () => {
      active = false;
      controller.abort();
    };
  }, [watchlistId, attempt]);

  function retry() {
    setError(null);
    setIsLoading(true);
    setAttempt((value) => value + 1);
  }

  async function acknowledgeReview() {
    if (!review || review.status !== "OPEN" || isAcknowledging) {
      return;
    }

    setIsAcknowledging(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/watchlists/${watchlistId}/reviews/${review.id}/acknowledge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: review.version,
          }),
        },
      );

      const acknowledgedReview =
        await readData<Review>(response);

      setReview(acknowledgedReview);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not acknowledge this review",
      );
    } finally {
      setIsAcknowledging(false);
    }
  }

  if (isLoading) {
    return (
      <section
        className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
        aria-busy="true"
      >
        <p className="text-slate-400">
          Preparing your review…
        </p>
      </section>
    );
  }

  const isAcknowledged = review?.status === "ACKNOWLEDGED";

  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">
            Since your last review
          </h3>

          <p className="mt-2 max-w-xl text-sm text-slate-400">
            A frozen comparison of what changed—not today’s
            percentage movement.
          </p>
        </div>

        {review && comparison ? (
          <button
            type="button"
            onClick={() => void acknowledgeReview()}
            disabled={isAcknowledging || review.status !== "OPEN"}
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAcknowledged
              ? "Reviewed"
              : isAcknowledging
                ? "Saving…"
                : "Mark as reviewed"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200"
        >
          <p>{error}</p>

          <button
            type="button"
            onClick={retry}
            disabled={isAcknowledging}
            className="mt-2 underline underline-offset-4"
          >
            Reload review
          </button>
        </div>
      ) : null}

      {isAcknowledged ? (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-300"
        >
          Saved. This snapshot is now your baseline for the
          next review.
        </p>
      ) : null}

      {comparison ? (
        <>
          <div className="mt-4 space-y-1 text-xs text-slate-500">
            <p>
              Snapshot: {formatTime(comparison.snapshotAt)}
            </p>

            {comparison.baselineSnapshotAt ? (
              <p>
                Compared with:{" "}
                {formatTime(comparison.baselineSnapshotAt)}
              </p>
            ) : null}

            <p>
              Historical snapshot · MVP rules · Not a live feed
            </p>
          </div>

          {!comparison.baselineReviewId ? (
            <div className="mt-5 rounded-xl border border-slate-700 p-5">
              <h4 className="font-medium">
                Your first review
              </h4>

              <p className="mt-2 text-sm text-slate-400">
                There is no acknowledged baseline yet. Mark
                this snapshot as reviewed to enable comparisons
                on your next visit.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-lg bg-amber-400/10 px-3 py-2 text-amber-300">
                  {comparison.summary.high} high attention
                </span>

                <span className="rounded-lg bg-blue-400/10 px-3 py-2 text-blue-300">
                  {comparison.summary.medium} medium
                </span>

                <span className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300">
                  {comparison.summary.low} low
                </span>

                <span className="rounded-lg bg-slate-800 px-3 py-2 text-slate-400">
                  {comparison.summary.none} below thresholds
                  </span>
                  
                  <span className="rounded-lg bg-slate-800 px-3 py-2 text-slate-400">
  {comparison.summary.unavailable} not assessed
</span>
              </div>

              <div className="mt-5 space-y-3">
                {comparison.changes.map((change) => (
                  <article
                    key={change.instrument.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">
                          {change.instrument.symbol}
                        </h4>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${badgeStyles[change.attentionLevel]}`}
                        >
                          {change.dataStatus === "UNAVAILABLE"
  ? "NOT ASSESSED"
  : change.attentionLevel}
                        </span>
                      </div>

                      <span className="text-sm font-medium">
                        {change.priceChangePercent === null
                          ? "No comparable price"
                          : `${change.priceChangePercent > 0 ? "+" : ""}${change.priceChangePercent.toFixed(2)}%`}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      {formatPrice(
                        change.baseline?.price ?? null,
                        change.instrument.currency,
                      )}
                      {" → "}
                      {formatPrice(
                        change.current.price,
                        change.instrument.currency,
                      )}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
  Data source:{" "}
  {change.baseline?.quoteSource ??
    "unknown"}
  {" → "}
  {change.current.quoteSource ??
    "unknown"}
</p>

                    <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-400">
                      {change.reasons.map((reason, index) => (
                        <li key={`${index}-${reason}`}>
                          {reason}
                        </li>
                      ))}
                    </ul>

                    {change.warnings.length > 0 ? (
  <div className="mt-3 rounded-lg bg-amber-400/10 p-3">
    <p className="text-xs font-medium text-amber-300">
      Data limitations
    </p>

    <ul className="mt-1 list-inside list-disc text-xs text-amber-200">
      {change.warnings.map((warning) => (
        <li key={warning}>{warning}</li>
      ))}
    </ul>
  </div>
                    ) : null}
                    
                    {change.current.price &&
change.current.providerTimestamp ? (
  <PriceHistoryChart
    instrumentId={change.instrument.id}
    symbol={change.instrument.symbol}
    currency={change.instrument.currency}
    markers={[
      ...(change.baseline?.price &&
      change.baseline.providerTimestamp
        ? [
            {
              label: "Last reviewed",
              price: change.baseline.price,
              timestamp:
                change.baseline.providerTimestamp,
              color: "#f59e0b",
            },
          ]
        : []),

      {
        label: "Current review",
        price: change.current.price,
        timestamp:
          change.current.providerTimestamp,
        color: "#22d3ee",
      },
    ]}
  />
) : null}
                  </article>
                ))}
                </div>
                <ReviewSummary
  key={comparison.reviewId}
  watchlistId={watchlistId}
  reviewId={comparison.reviewId}
/>
            </>
          )}
        </>
      ) : null}
    </section>
  );
}