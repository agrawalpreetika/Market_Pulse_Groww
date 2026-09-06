"use client";

import { useRef, useState } from "react";

type SummaryResult = {
  reviewId: string;
  policyVersion: string;
  summary: string;
  highlights: string[];
  provider: "template" | "ollama";
  model: string | null;
  fallbackUsed: boolean;
  generatedAt: string;
  disclosure: string;
};

type Props = {
  watchlistId: string;
  reviewId: string;
};

export function ReviewSummary({
  watchlistId,
  reviewId,
}: Props) {
  const [result, setResult] =
    useState<SummaryResult | null>(null);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const pending = useRef(false);

  async function generate() {
    if (pending.current) {
      return;
    }

    pending.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/watchlists/${watchlistId}/reviews/${reviewId}/summary`,
        {
          method: "POST",
        },
      );

      const rawBody = await response.text();

      let body: {
        data?: SummaryResult;
        error?: {
          message?: string;
        };
      } = {};

      if (rawBody) {
        try {
          body = JSON.parse(rawBody) as typeof body;
        } catch {
          throw new Error(
            "The server returned an invalid response.",
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          body.error?.message ??
            `Summary request failed with HTTP ${response.status}.`,
        );
      }

      if (!body.data) {
        throw new Error(
          "The server returned an empty summary.",
        );
      }

      setResult(body.data);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not generate the summary.",
      );
    } finally {
      pending.current = false;
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-medium text-violet-200">
            Review explanation
          </h4>

          <p className="mt-1 text-xs text-slate-400">
            Generated only from the verified comparison above.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={isLoading}
          className="rounded-lg bg-violet-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {isLoading
            ? "Generating…"
            : result
              ? "Regenerate"
              : "Generate explanation"}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-950/40 p-3 text-sm text-red-200"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4">
          <p className="text-sm text-slate-200">
            {result.summary}
          </p>

          {result.highlights.length > 0 ? (
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-400">
              {result.highlights.map(
                (highlight, index) => (
                  <li key={`${index}-${highlight}`}>
                    {highlight}
                  </li>
                ),
              )}
            </ul>
          ) : null}

          <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
            <p>{result.disclosure}</p>

            <p className="mt-1">
              Source:{" "}
              {result.provider === "ollama"
                ? `Local Ollama model (${result.model})`
                : "Deterministic template"}
              {" · "}
              Policy: {result.policyVersion}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}