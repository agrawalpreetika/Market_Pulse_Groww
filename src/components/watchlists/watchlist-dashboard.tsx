"use client";

import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";

import { ReviewPanel } from "./review-panel";
import { CreateWatchlistForm } from "./create-watchlist-form";
import { InstrumentSearch } from "./instrument-search";
import { RemoveInstrumentButton } from "./remove-instrument-button";
import { WatchlistActions } from "./watchlist-actions";
import { PriceHistoryChart } from "./price-history-chart";

type WatchlistSummary = {
  id: string;
  name: string;
  version: number;
  itemCount: number;
};

type LatestQuote = {
  price: string;
  change: {
    absolute: string;
    percent: string;
  } | null;
  volume: string | null;
  quality: string;
  session: string;
  source: string;
  providerTimestamp: string;
  freshness: {
    status: string;
    ageSeconds: number;
  };
};

type WatchlistItem = {
  id: string;
  instrument: {
    id: string;
    symbol: string;
    name: string;
    exchange: string;
    currency: string;
    latestQuote: LatestQuote | null;
  };
};

type WatchlistDetail = {
  id: string;
  name: string;
  version: number;
  items: WatchlistItem[];
};

type Props = {
  currentUser: {
    name: string;
    email: string;
  };
};

function formatPrice(
  value: string,
  currency: string,
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatVolume(value: string | null) {
  if (!value) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

export function WatchlistDashboard({ currentUser }: Props) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [showInstrumentSearch, setShowInstrumentSearch] = useState(false);

  const [lastDisplayedRefreshAt, setLastDisplayedRefreshAt] =
    useState<Date | null>(null);

  const [watchlists, setWatchlists] = useState<
    WatchlistSummary[]
  >([]);

  const [selectedWatchlistId, setSelectedWatchlistId] =
    useState<string | null>(null);

  const [watchlist, setWatchlist] =
    useState<WatchlistDetail | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function loadWatchlists() {
      try {
        setError(null);

        const response = await fetch(
          "/api/watchlists",
        );

        if (!response.ok) {
          throw new Error(
            "Could not load watchlists",
          );
        }

        const result = (await response.json()) as {
          data: WatchlistSummary[];
        };

        setWatchlists(result.data);

        const initialWatchlist =
          result.data.find(
            (item) => item.itemCount > 0,
          ) ?? result.data[0];

        if (initialWatchlist) {
          setSelectedWatchlistId(
            initialWatchlist.id,
          );
        }
      } catch {
        setError(
          "We could not load your watchlists. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadWatchlists();
  }, []);

  useEffect(() => {
  if (!selectedWatchlistId) {
    return;
  }

  const controller = new AbortController();
  let active = true;

  async function loadWatchlist() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/watchlists/${selectedWatchlistId}`,
        {
          signal: controller.signal,
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Could not load watchlist");
      }

      const result = (await response.json()) as {
        data: WatchlistDetail;
      };

      if (active) {
        setWatchlist(result.data);
        setLastDisplayedRefreshAt(new Date());
      }
    } catch {
      if (active && !controller.signal.aborted) {
        setError(
          "We could not load this watchlist. Please try again.",
        );
      }
    } finally {
      if (active) {
        setIsLoading(false);
      }
    }
  }

  void loadWatchlist();

  return () => {
    active = false;
    controller.abort();
  };
}, [selectedWatchlistId, refreshVersion]);

  useEffect(() => {
    if (!selectedWatchlistId) {
      return;
    }

    const pollingInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      setRefreshVersion((current) => current + 1);
    }, 60_000);

    return () => {
      window.clearInterval(pollingInterval);
    };
  }, [selectedWatchlistId]);
    
    function handleWatchlistCreated(
  createdWatchlist: WatchlistSummary,
) {
  setWatchlists((current) => [
    createdWatchlist,
    ...current.filter(
      (item) => item.id !== createdWatchlist.id,
    ),
  ]);

  setWatchlist(null);
  setError(null);
  setIsLoading(true);
  setSelectedWatchlistId(createdWatchlist.id);
    }
    
    function handleInstrumentAdded(watchlistId: string) {
  setWatchlists((current) =>
    current.map((item) =>
      item.id === watchlistId
        ? {
            ...item,
            itemCount: item.itemCount + 1,
          }
        : item,
    ),
  );

  setRefreshVersion((current) => current + 1);
    }
    
    function handleInstrumentRemoved(
  watchlistId: string,
  instrumentId: string,
) {
  setWatchlists((current) =>
    current.map((item) =>
      item.id === watchlistId
        ? {
            ...item,
            itemCount: Math.max(0, item.itemCount - 1),
          }
        : item,
    ),
  );

  setWatchlist((current) => {
    if (!current || current.id !== watchlistId) {
      return current;
    }

    return {
      ...current,
      items: current.items.filter(
        (item) => item.instrument.id !== instrumentId,
      ),
    };
  });

  setRefreshVersion((current) => current + 1);
    }
    
    function handleWatchlistRenamed(updated: {
  id: string;
  name: string;
  version: number;
}) {
  setWatchlists((current) =>
    current.map((item) =>
      item.id === updated.id
        ? { ...item, ...updated }
        : item,
    ),
  );

  setWatchlist((current) =>
    current?.id === updated.id
      ? { ...current, ...updated }
      : current,
  );
}

function handleWatchlistDeleted(watchlistId: string) {
  setWatchlists((current) =>
    current.filter((item) => item.id !== watchlistId),
  );

  setWatchlist((current) =>
    current?.id === watchlistId ? null : current,
  );

  setSelectedWatchlistId((current) =>
    current === watchlistId ? null : current,
  );

  setError(null);
}

function refreshDisplayedData() {
  if (isLoading) {
    return;
  }

  setRefreshVersion((current) => current + 1);
}

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-cyan-400">
              MARKETPULSE
            </p>

            <h1 className="mt-1 text-xl font-semibold">
              Smart Market Watchlist
            </h1>
          </div>

          <div className="text-right">
            <p className="text-sm font-medium text-slate-200">
              {currentUser.name}
            </p>

            <p className="text-xs text-slate-500">
              {currentUser.email}
            </p>

            <div className="mt-1">
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[260px_1fr]">
        <aside>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Your watchlists
          </p>

          <div className="space-y-2">
            {watchlists.map((item) => {
              const isSelected =
                item.id === selectedWatchlistId;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setShowInstrumentSearch(false);
                    setSelectedWatchlistId(item.id);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                    isSelected
                      ? "bg-cyan-400 text-slate-950"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="font-medium">
                    {item.name}
                  </span>

                  <span className="text-sm">
                    {item.itemCount}
                  </span>
                </button>
              );
            })}
                  </div>
                  
                  <CreateWatchlistForm
  onCreated={handleWatchlistCreated}
/>
        </aside>

              <section>
                  {!selectedWatchlistId && !isLoading ? (
  <div className="rounded-xl border border-slate-800 p-8">
    <h2 className="text-xl font-semibold">
      {watchlists.length === 0
        ? "Create your first watchlist"
        : "Choose a watchlist"}
    </h2>

    <p className="mt-2 text-slate-400">
      {watchlists.length === 0
        ? "Use the sidebar form to start tracking instruments."
        : "Select a watchlist from the sidebar to continue."}
    </p>
  </div>
) : null}
          {error ? (
            <div className="rounded-xl border border-red-900 bg-red-950/40 p-5 text-red-200">
              {error}
            </div>
          ) : null}

          {isLoading &&
(!watchlist || watchlist.id !== selectedWatchlistId) ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-slate-400">
              Loading market information…
            </div>
          ) : null}

          {watchlist && watchlist.id === selectedWatchlistId ? (
            <>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">
                    Watchlist
                  </p>

                  <h2 className="mt-1 text-3xl font-semibold">
                    {watchlist.name}
                  </h2>

                  <p className="mt-2 text-slate-400">
                    {watchlist.items.length} instruments
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInstrumentSearch((current) => !current)}
                      aria-expanded={showInstrumentSearch}
                      className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                    >
                      {showInstrumentSearch ? "Close search" : "Add instrument"}
                    </button>

                    <button
                      type="button"
                      onClick={refreshDisplayedData}
                      disabled={isLoading}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-cyan-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {lastDisplayedRefreshAt
                      ? `Checked ${lastDisplayedRefreshAt.toLocaleTimeString(
                          "en-IN",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          },
                        )}`
                      : "Waiting for market data"}
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    Automatically checks every 60 seconds
                  </p>
                </div>
              </div>
              
              <details className="mb-4 text-sm text-slate-400">
                <summary className="cursor-pointer hover:text-slate-200">Watchlist settings</summary>
                <div className="mt-3">
                  <WatchlistActions
                    key={`${watchlist.id}-${watchlist.version}`}
                    watchlist={watchlist}
                    onRenamed={handleWatchlistRenamed}
                    onDeleted={handleWatchlistDeleted}
                  />
                </div>
              </details>

              {showInstrumentSearch ? (
                <InstrumentSearch
                  key={`instrument-search-${watchlist.id}`}
                  watchlistId={watchlist.id}
                  existingInstrumentIds={watchlist.items.map((item) => item.instrument.id)}
                  onAdded={handleInstrumentAdded}
                />
              ) : null}
            {watchlist.items.length > 0 ? (
  <ReviewPanel
    key={`review-panel-${watchlist.id}`}
    watchlistId={watchlist.id}
  />
) : null}
              {watchlist.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
                  <h3 className="text-lg font-medium">
                    This watchlist is empty
                  </h3>

                  <p className="mt-2 text-slate-400">
                    Add an instrument to start monitoring market changes.
                  </p>
                </div>
              ) : (
                <section aria-labelledby="current-market-heading">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Current market
                    </p>
                    <h3 id="current-market-heading" className="mt-1 text-lg font-semibold">
                      Latest prices
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Today’s market position. This is separate from the since-review comparison above.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                    <div className="hidden grid-cols-[1.5fr_1fr_1fr] gap-4 border-b border-slate-800 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid">
                      <span>Instrument</span>
                      <span>Price and today</span>
                      <span>Availability</span>
                    </div>

                    {watchlist.items.map((item) => {
                      const quote = item.instrument.latestQuote;
                      const percentChange = quote?.change
                        ? Number(quote.change.percent)
                        : null;

                      return (
                        <article
                          key={item.id}
                          className="grid gap-4 border-b border-slate-800 px-5 py-5 last:border-b-0 md:grid-cols-[1.5fr_1fr_1fr] md:items-center"
                        >
                          <div>
                            <div className="font-semibold">{item.instrument.symbol}</div>
                            <div className="mt-1 text-sm text-slate-400">{item.instrument.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.instrument.exchange}</div>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500 md:hidden">Price and today</p>
                            <p className="mt-1 font-medium">
                              {quote ? formatPrice(quote.price, item.instrument.currency) : "Unavailable"}
                            </p>
                            <p className={`mt-1 text-sm font-medium ${
                              percentChange === null
                                ? "text-slate-400"
                                : percentChange >= 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                            }`}>
                              {percentChange === null
                                ? "Today unavailable"
                                : `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}% today`}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500 md:hidden">Availability</p>
                            {quote ? (
                              <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                quote.freshness.status === "FRESH"
                                  ? "bg-emerald-400/10 text-emerald-300"
                                  : "bg-amber-400/10 text-amber-300"
                              }`}>
                                {quote.freshness.status.replaceAll("_", " ")}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">No quote</span>
                            )}
                          </div>

                          <details className="md:col-span-3">
                            <summary className="cursor-pointer text-xs font-medium text-cyan-300">
                              Chart and data details
                            </summary>
                            <div className="mt-3 rounded-lg bg-slate-950/50 p-3 text-xs text-slate-400">
                              <p>
                                Volume: {formatVolume(quote?.volume ?? null)}
                                {quote ? ` · ${quote.quality} · ${quote.source}` : ""}
                              </p>
                              <PriceHistoryChart
                                instrumentId={item.instrument.id}
                                symbol={item.instrument.symbol}
                                currency={item.instrument.currency}
                              />
                              <RemoveInstrumentButton
                                watchlistId={watchlist.id}
                                instrumentId={item.instrument.id}
                                symbol={item.instrument.symbol}
                                onRemoved={handleInstrumentRemoved}
                              />
                            </div>
                          </details>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
