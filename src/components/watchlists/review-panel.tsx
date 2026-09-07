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
type SignalConfidence = "HIGH" | "MEDIUM" | "LOW";

type Change = {
  instrument: { id: string; symbol: string; name: string; currency: string };
  current: {
    price: string | null;
    providerTimestamp: string | null;
    quoteSource: string | null;
    referenceContext: {
      sampleCount: number;
      volatilityPercent: string | null;
      recentHigh: string | null;
      recentLow: string | null;
      medianDailyVolume: string | null;
      volumeSampleCount: number;
      horizonSessions: number;
      source: string | null;
      priceBasis: "NONE" | "ADJUSTED_CLOSE";
    };
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
  confidence: SignalConfidence;
  appliedThresholds: {
    lowPercent: number;
    mediumPercent: number;
    highPercent: number;
  };
  signals: string[];
  volatilityMultiple: number | null;
  volumeMultiple: number | null;
  rangeBreakout: "UP" | "DOWN" | null;
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
  policy: { version: string; displayName: string };
};

type Props = { watchlistId: string };

const badgeStyles: Record<AttentionLevel, string> = {
  HIGH: "bg-amber-400/15 text-amber-300",
  MEDIUM: "bg-blue-400/15 text-blue-300",
  LOW: "bg-slate-700 text-slate-200",
  NONE: "bg-slate-800 text-slate-400",
};

const signalLabels: Record<string, string> = {
  REVIEW_PERIOD_PRICE_MOVE: "Since-review movement",
  SESSION_DIRECTION_REVERSAL: "Session reversal",
  VOLATILITY_ADJUSTED_MOVE: "Unusual for recent volatility",
  RECENT_RANGE_BREAKOUT: "Recent-range breakout",
  ABNORMAL_CLOSED_SESSION_VOLUME: "Unusually high completed-session volume",
};

function formatPrice(value: string | null, currency: string) {
  if (value === null) return "Unavailable";
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

async function readData<T>(response: Response): Promise<T> {
  const result = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(result.error?.message ?? "The request failed");
  if (result.data === undefined) throw new Error("The server returned an unexpected response");
  return result.data;
}

function ChangeCard({ change, policyVersion }: { change: Change; policyVersion: string }) {
  const label = change.dataStatus === "UNAVAILABLE"
    ? "NOT ASSESSED"
    : change.attentionLevel;
  const percentage = change.priceChangePercent === null
    ? "No comparable price"
    : `${change.priceChangePercent > 0 ? "+" : ""}${change.priceChangePercent.toFixed(2)}%`;

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{change.instrument.symbol}</h4>
            <span className={`rounded-full px-2.5 py-1 text-xs ${badgeStyles[change.attentionLevel]}`}>
              {label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            {change.reasons[0] ?? "No reliable movement was identified"}
          </p>
        </div>

        <div className="text-right">
          <p className="font-semibold">{percentage}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatPrice(change.baseline?.price ?? null, change.instrument.currency)} →{" "}
            {formatPrice(change.current.price, change.instrument.currency)}
          </p>
        </div>
      </div>

      <details className="mt-3 border-t border-slate-800 pt-3">
        <summary className="cursor-pointer text-sm font-medium text-cyan-300">
          Why this result?
        </summary>

        <div className="mt-3 space-y-3 text-xs text-slate-400">
          {change.reasons.length > 1 ? (
            <ul className="list-inside list-disc space-y-1">
              {change.reasons.slice(1).map((reason, index) => (
                <li key={`${index}-${reason}`}>{reason}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-800 px-2.5 py-1">
              Confidence: {change.confidence.toLowerCase()}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-1">
              Movement levels: {change.appliedThresholds.lowPercent}% /{" "}
              {change.appliedThresholds.mediumPercent}% / {change.appliedThresholds.highPercent}%
            </span>
            {change.signals.map((signal) => (
              <span key={signal} className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-200">
                {signalLabels[signal] ?? signal}
              </span>
            ))}
          </div>

          <p>
            Source: {change.baseline?.quoteSource ?? "unknown"} →{" "}
            {change.current.quoteSource ?? "unknown"}
          </p>

          {["historical-context-v3", "observed-context-v4", "daily-context-v5"].includes(policyVersion) ? (
            <p className="rounded-lg border border-slate-800 p-3">
              Historical samples: {change.current.referenceContext.sampleCount}
              {policyVersion === "daily-context-v5"
                ? ` · Review horizon: ${change.current.referenceContext.horizonSessions} session(s) · Basis: ${change.current.referenceContext.priceBasis.toLowerCase().replaceAll("_", " ")}`
                : ". Volatility and completed-session volume are not used by V4 until daily-history evidence is integrated into snapshots."}
            </p>
          ) : null}

          {change.warnings.length > 0 ? (
            <div className="rounded-lg bg-amber-400/10 p-3 text-amber-200">
              <p className="font-medium text-amber-300">Data quality notes</p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                {change.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          ) : null}

          {change.current.price && change.current.providerTimestamp ? (
            <PriceHistoryChart
              instrumentId={change.instrument.id}
              symbol={change.instrument.symbol}
              currency={change.instrument.currency}
              markers={[
                ...(change.baseline?.price && change.baseline.providerTimestamp
                  ? [{
                      label: "Last reviewed",
                      price: change.baseline.price,
                      timestamp: change.baseline.providerTimestamp,
                      color: "#f59e0b",
                    }]
                  : []),
                {
                  label: "Current review",
                  price: change.current.price,
                  timestamp: change.current.providerTimestamp,
                  color: "#22d3ee",
                },
              ]}
            />
          ) : null}
        </div>
      </details>
    </article>
  );
}

export function ReviewPanel({ watchlistId }: Props) {
  const [review, setReview] = useState<Review | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadReview() {
      try {
        const loadedReview = await readData<Review>(await fetch(
          `/api/watchlists/${watchlistId}/reviews`,
          { method: "POST", signal: controller.signal, cache: "no-store" },
        ));
        const loadedComparison = await readData<Comparison>(await fetch(
          `/api/watchlists/${watchlistId}/reviews/${loadedReview.id}/changes`,
          { signal: controller.signal, cache: "no-store" },
        ));
        if (active) {
          setReview(loadedReview);
          setComparison(loadedComparison);
        }
      } catch (cause: unknown) {
        if (active && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load your review");
        }
      } finally {
        if (active) setIsLoading(false);
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
    if (!review || review.status !== "OPEN" || isAcknowledging) return;
    setIsAcknowledging(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/watchlists/${watchlistId}/reviews/${review.id}/acknowledge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: review.version }),
        },
      );
      setReview(await readData<Review>(response));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not acknowledge this review");
    } finally {
      setIsAcknowledging(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5" aria-busy="true">
        <p className="text-sm text-slate-400">Checking what changed…</p>
      </section>
    );
  }

  const isAcknowledged = review?.status === "ACKNOWLEDGED";
  const attentionChanges = comparison?.changes.filter(
    (change) => change.dataStatus !== "UNAVAILABLE" && change.attentionLevel !== "NONE",
  ) ?? [];
  const otherChanges = comparison?.changes.filter(
    (change) => change.dataStatus === "UNAVAILABLE" || change.attentionLevel === "NONE",
  ) ?? [];

  return (
    <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Attention summary</p>
          <h3 className="mt-1 text-xl font-semibold">What changed since you last checked</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            This compares the current snapshot with the last one you marked as reviewed.
          </p>
        </div>

        {review && comparison ? (
          <button
            type="button"
            onClick={() => void acknowledgeReview()}
            disabled={isAcknowledging || review.status !== "OPEN"}
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAcknowledged ? "Reviewed" : isAcknowledging ? "Saving…" : "Mark as reviewed"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          <p>{error}</p>
          <button type="button" onClick={retry} className="mt-2 underline underline-offset-4">
            Reload review
          </button>
        </div>
      ) : null}

      {isAcknowledged ? (
        <p role="status" className="mt-4 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-300">
          Saved. This becomes the starting point for your next comparison.
        </p>
      ) : null}

      {comparison ? (
        <>
          {!comparison.baselineReviewId ? (
            <div className="mt-5 rounded-xl border border-slate-700 p-5">
              <h4 className="font-medium">Set your starting point</h4>
              <p className="mt-2 text-sm text-slate-400">
                Mark this first snapshot as reviewed. On your next visit, MarketPulse will show what changed from it.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                <span className="rounded-lg bg-amber-400/10 px-3 py-2 text-amber-300">
                  {attentionChanges.length} need attention
                </span>
                {comparison.summary.unavailable > 0 ? (
                  <span className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300">
                    {comparison.summary.unavailable} could not be assessed
                  </span>
                ) : null}
              </div>

              {attentionChanges.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {attentionChanges.map((change) => (
                    <ChangeCard key={change.instrument.id} change={change} policyVersion={comparison.policy.version} />
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                  <h4 className="font-medium text-emerald-200">Nothing needs attention right now</h4>
                  <p className="mt-1 text-sm text-slate-400">
                    No reliably comparable instrument crossed its meaningful-movement level.
                  </p>
                </div>
              )}

              {otherChanges.length > 0 ? (
                <details className="mt-4 rounded-xl border border-slate-800 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-300">
                    Show {otherChanges.length} other comparison{otherChanges.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-4 space-y-3">
                    {otherChanges.map((change) => (
                      <ChangeCard key={change.instrument.id} change={change} policyVersion={comparison.policy.version} />
                    ))}
                  </div>
                </details>
              ) : null}

              <details className="mt-4 text-xs text-slate-500">
                <summary className="cursor-pointer">Comparison details</summary>
                <div className="mt-2 space-y-1 pl-1">
                  <p>Current snapshot: {formatTime(comparison.snapshotAt)}</p>
                  {comparison.baselineSnapshotAt ? (
                    <p>Previous review: {formatTime(comparison.baselineSnapshotAt)}</p>
                  ) : null}
                  <p>Rules: {comparison.policy.displayName} · Frozen snapshot · Not a live feed</p>
                  {comparison.policy.version === "historical-context-v3" ? (
                    <p className="text-amber-300">
                      Legacy V3 results may overstate historical significance; daily completeness was not verified.
                    </p>
                  ) : null}
                </div>
              </details>

              <details className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
                <summary className="cursor-pointer text-sm font-medium text-violet-200">
                  Optional AI explanation
                </summary>
                <ReviewSummary
                  key={comparison.reviewId}
                  watchlistId={watchlistId}
                  reviewId={comparison.reviewId}
                />
              </details>
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
