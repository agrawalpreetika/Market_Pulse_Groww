"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type Instrument = {
  id?: string;
  source: "CATALOG" | "YAHOO";
  providerIdentifier: string | null;
  symbol: string;
  name: string;
  exchange: string;
  status: string;
};

type Props = {
  watchlistId: string;
  existingInstrumentIds: string[];
  onAdded: (watchlistId: string) => void;
};

function getInstrumentKey(
  instrument: Instrument,
): string {
  if (instrument.id) {
    return instrument.id;
  }

  return `${instrument.source}:${instrument.providerIdentifier}`;
}

export function InstrumentSearch({
  watchlistId,
  existingInstrumentIds,
  onAdded,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Instrument[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [discoveryStatus, setDiscoveryStatus] =
    useState<"AVAILABLE" | "UNAVAILABLE" | "SKIPPED" | null>(
      null,
    );

  const active = useRef(true);
  const searchPending = useRef(false);
  const addPending = useRef(false);

  useEffect(() => {
    active.current = true;

    return () => {
      active.current = false;
    };
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = query.trim();

    if (!value || searchPending.current) {
      return;
    }

    searchPending.current = true;
    setIsSearching(true);
    setError(null);
    setMessage(null);
    setResults([]);
    setHasSearched(false);
    setDiscoveryStatus(null);

    try {
      const response = await fetch(
        `/api/instruments?query=${encodeURIComponent(value)}`,
        { cache: "no-store" },
      );

      const result = (await response.json()) as {
        data?: Instrument[];
        meta?: {
          discoveryStatus?:
            | "AVAILABLE"
            | "UNAVAILABLE"
            | "SKIPPED";
        };
        error?: { message?: string };
      };

      if (!response.ok || !result.data) {
        throw new Error(
          result.error?.message ?? "Search failed.",
        );
      }

      if (active.current) {
        setResults(result.data);
        setHasSearched(true);
        setDiscoveryStatus(
          result.meta?.discoveryStatus ?? null,
        );
      }
    } catch (cause: unknown) {
      if (active.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not search instruments.",
        );
      }
    } finally {
      searchPending.current = false;

      if (active.current) {
        setIsSearching(false);
      }
    }
  }

  async function addInstrument(instrument: Instrument) {
    const instrumentKey =
      getInstrumentKey(instrument);
    
    if (addPending.current) {
      return;
    }

    addPending.current = true;
    setAddingId(instrumentKey);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/watchlists/${watchlistId}/items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
  instrument.source === "YAHOO"
    ? {
        source: "YAHOO",
        providerIdentifier:
          instrument.providerIdentifier,
      }
    : {
        source: "CATALOG",
        instrumentId: instrument.id,
      },
),
        },
      );

      if (!response.ok) {
        const result = (await response.json()) as {
          error?: { message?: string };
        };

        throw new Error(
          result.error?.message ??
            "Could not add the instrument.",
        );
      }

      // Refresh dashboard state even if the user switched lists
      // while the server was processing this request.
      onAdded(watchlistId);

      if (active.current) {
        setAddedKeys((current) => [
  ...current,
  instrumentKey,
]);
        setMessage(`${instrument.symbol} added.`);
      }
    } catch (cause: unknown) {
      if (active.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not add the instrument.",
        );
      }
    } finally {
      addPending.current = false;

      if (active.current) {
        setAddingId(null);
      }
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="font-semibold">Add an instrument</h3>

      <form
        onSubmit={search}
        className="mt-3 flex flex-wrap gap-2"
      >
        <label htmlFor="instrument-query" className="sr-only">
          Search by symbol or company name
        </label>

        <input
          id="instrument-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search INFY, TCS, WIPRO…"
          required
          disabled={isSearching}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"
        />

        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-50"
        >
          {isSearching ? "Searching…" : "Search"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {message ? (
        <p role="status" className="mt-3 text-sm text-emerald-300">
          {message}
        </p>
      ) : null}

      {hasSearched && discoveryStatus === "UNAVAILABLE" ? (
        <p
          role="status"
          className="mt-3 rounded-lg bg-amber-400/10 p-3 text-sm text-amber-200"
        >
          Yahoo search is temporarily unavailable. Saved
          instruments can still be searched and added.
        </p>
      ) : null}

      {hasSearched &&
      results.length === 0 &&
      discoveryStatus !== "UNAVAILABLE" ? (
        <p className="mt-3 text-sm text-slate-400">
          No matching instruments found.
        </p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {results.map((instrument) => {
          const instrumentKey =
  getInstrumentKey(instrument);
          const alreadyAdded =
  Boolean(
    instrument.id &&
      existingInstrumentIds.includes(
        instrument.id,
      ),
  ) ||
  addedKeys.includes(instrumentKey);

          return (
            <li
              key={instrumentKey}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-3"
            >
              <div>
                <p className="font-medium">
                  {instrument.symbol}
                  <span className="ml-2 text-xs text-slate-500">
                    {instrument.exchange}
                  </span>
                </p>

                <p className="text-sm text-slate-400">
                  {instrument.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
  {instrument.source === "CATALOG"
    ? "Saved instrument"
    : "Discovered through Yahoo"}
</p>
              </div>

              <button
                type="button"
                onClick={() => void addInstrument(instrument)}
                disabled={
                  alreadyAdded ||
                  addingId !== null ||
                  instrument.status !== "ACTIVE" ||
                  (instrument.source === "YAHOO" &&
  !instrument.providerIdentifier)
                }
                className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {alreadyAdded
                  ? "Added"
                  : addingId === instrumentKey
                    ? "Adding…"
                    : instrument.status !== "ACTIVE"
                      ? "Unavailable"
                      : "Add"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
