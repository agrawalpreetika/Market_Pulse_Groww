"use client";

import { useEffect, useMemo, useState } from "react";

type Range = "1D" | "1W" | "1M" | "3M";

type HistoryPoint = {
  id: string;
  price: string;
  quality: string;
  source: string;
  timestamp: string;
};

type HistoryResponse = {
  instrument: {
    symbol: string;
    currency: string;
  };
  range: Range;
  points: HistoryPoint[];
};

type ReviewMarker = {
  label: string;
  price: string;
  timestamp: string;
  color: string;
};

type Props = {
  instrumentId: string;
  symbol: string;
  currency: string;
  markers?: ReviewMarker[];
};

const ranges: Range[] = ["1D", "1W", "1M", "3M"];

function formatPrice(
  value: number,
  currency: string,
) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function PriceHistoryChart({
  instrumentId,
  symbol,
  currency,
  markers = [],
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [range, setRange] = useState<Range>("1W");
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadHistory() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/instruments/${instrumentId}/history?range=${range}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const result = (await response.json()) as {
          data?: HistoryResponse;
          error?: { message?: string };
        };

        if (!response.ok || !result.data) {
          throw new Error(
            result.error?.message ??
              "Could not load price history.",
          );
        }

        if (active) {
          setPoints(result.data.points);
        }
      } catch (cause: unknown) {
        if (active && !controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load price history.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      active = false;
      controller.abort();
    };
  }, [instrumentId, isOpen, range]);

  const chart = useMemo(() => {
    const validPoints = points
      .map((point) => ({
        ...point,
        numericPrice: Number(point.price),
        numericTime: new Date(point.timestamp).getTime(),
      }))
      .filter(
        (point) =>
          Number.isFinite(point.numericPrice) &&
          Number.isFinite(point.numericTime),
      );

    if (validPoints.length === 0) {
      return null;
    }

    const width = 700;
    const height = 220;
    const padding = 24;

    const prices = validPoints.map(
      (point) => point.numericPrice,
    );

    const times = validPoints.map(
      (point) => point.numericTime,
    );

    const minimumPrice = Math.min(...prices);
    const maximumPrice = Math.max(...prices);
    const minimumTime = Math.min(...times);
    const maximumTime = Math.max(...times);

    const priceSpan =
      maximumPrice - minimumPrice || 1;

    const timeSpan =
      maximumTime - minimumTime || 1;

    const coordinates = validPoints.map(
      (point) => {
        const x =
          padding +
          ((point.numericTime - minimumTime) /
            timeSpan) *
            (width - padding * 2);

        const y =
          height -
          padding -
          ((point.numericPrice - minimumPrice) /
            priceSpan) *
            (height - padding * 2);

        return {
          ...point,
          x,
          y,
        };
      },
    );
      
      const markerCoordinates = markers
  .map((marker) => {
    const numericPrice = Number(marker.price);
    const numericTime =
      new Date(marker.timestamp).getTime();

    if (
      !Number.isFinite(numericPrice) ||
      !Number.isFinite(numericTime) ||
      numericTime < minimumTime ||
      numericTime > maximumTime
    ) {
      return null;
    }

    const x =
      padding +
      ((numericTime - minimumTime) /
        timeSpan) *
        (width - padding * 2);

    const y =
      height -
      padding -
      ((numericPrice - minimumPrice) /
        priceSpan) *
        (height - padding * 2);

    return {
      ...marker,
      numericPrice,
      x,
      y,
    };
  })
  .filter(
    (
      marker,
    ): marker is NonNullable<typeof marker> =>
      marker !== null,
  );

    return {
      width,
      height,
        coordinates,
      markerCoordinates,
      polyline: coordinates
        .map((point) => `${point.x},${point.y}`)
        .join(" "),
      minimumPrice,
      maximumPrice,
    };
  }, [markers, points]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="text-xs text-cyan-300 underline underline-offset-4"
      >
        {isOpen ? "Hide price history" : "View price history"}
      </button>

      {isOpen ? (
        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h5 className="text-sm font-medium">
              {symbol} price history
            </h5>

            <div
              className="flex gap-1"
              aria-label="Chart range"
            >
              {ranges.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRange(item)}
                  aria-pressed={range === item}
                  className={`rounded px-2 py-1 text-xs ${
                    range === item
                      ? "bg-cyan-400 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-400">
              Loading chart…
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          {!isLoading && !error && points.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No price history is available for this range.
            </p>
          ) : null}

          {!isLoading && !error && chart ? (
            <>
              <div className="mt-4 overflow-x-auto">
                <svg
                  viewBox={`0 0 ${chart.width} ${chart.height}`}
                  role="img"
                  aria-labelledby={`${instrumentId}-chart-title ${instrumentId}-chart-description`}
                  className="h-56 min-w-[500px] w-full"
                >
                  <title id={`${instrumentId}-chart-title`}>
                    {symbol} price history
                  </title>

                  <desc id={`${instrumentId}-chart-description`}>
                    {points.length} stored price observations.
                    Lowest price{" "}
                    {formatPrice(
                      chart.minimumPrice,
                      currency,
                    )}
                    . Highest price{" "}
                    {formatPrice(
                      chart.maximumPrice,
                      currency,
                    )}
                    .
                  </desc>

                  <line
                    x1="24"
                    x2={chart.width - 24}
                    y1={chart.height - 24}
                    y2={chart.height - 24}
                    stroke="#334155"
                  />

                  <polyline
                    points={chart.polyline}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {chart.coordinates.map((point) => (
                    <circle
                      key={point.id}
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      fill="#0f172a"
                      stroke="#22d3ee"
                      strokeWidth="3"
                    >
                      <title>
                        {formatPrice(
                          point.numericPrice,
                          currency,
                        )}
                        {" — "}
                        {new Date(
                          point.timestamp,
                        ).toLocaleString("en-IN")}
                      </title>
                    </circle>
                  ))}
                                  
                                  {chart.markerCoordinates.map((marker) => (
  <g key={`${marker.label}-${marker.timestamp}`}>
    <line
      x1={marker.x}
      x2={marker.x}
      y1="18"
      y2={chart.height - 24}
      stroke={marker.color}
      strokeWidth="2"
      strokeDasharray="6 5"
    />

    <circle
      cx={marker.x}
      cy={marker.y}
      r="7"
      fill={marker.color}
      stroke="#020617"
      strokeWidth="3"
    >
      <title>
        {marker.label}:{" "}
        {formatPrice(
          marker.numericPrice,
          currency,
        )}
      </title>
    </circle>

    <text
      x={marker.x}
      y="14"
      textAnchor="middle"
      fill={marker.color}
      fontSize="11"
    >
      {marker.label}
    </text>
  </g>
))}
                              </svg>
                              {markers.length > 0 ? (
  <div className="mt-3 flex flex-wrap gap-4 text-xs">
    {markers.map((marker) => (
      <span
        key={`${marker.label}-${marker.timestamp}`}
        className="flex items-center gap-2 text-slate-400"
      >
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: marker.color,
          }}
        />

        {marker.label}:{" "}
        {formatPrice(
          Number(marker.price),
          currency,
        )}
      </span>
    ))}
  </div>
) : null}
              </div>

              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>
                  Low{" "}
                  {formatPrice(
                    chart.minimumPrice,
                    currency,
                  )}
                </span>

                <span>
                  High{" "}
                  {formatPrice(
                    chart.maximumPrice,
                    currency,
                  )}
                </span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}