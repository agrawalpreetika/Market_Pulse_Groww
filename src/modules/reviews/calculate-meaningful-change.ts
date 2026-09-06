import type { ChangeDetectionPolicy } from "@/modules/change-detection/change-detection-policy";

export type AttentionLevel =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NONE";

export type ChangeDirection =
  | "UP"
  | "DOWN"
  | "UNCHANGED"
  | "UNKNOWN";

export type ComparisonDataStatus =
  | "AVAILABLE"
  | "LIMITED"
  | "UNAVAILABLE";

export type SnapshotForComparison = {
  price: number | null;
  volume: bigint | null;
  quoteQuality: string | null;
  quoteSource: string | null;
  freshnessStatus: string;
  quoteAgeSeconds: number | null;
};

export type MeaningfulChange = {
  attentionLevel: AttentionLevel;
  score: number;
  direction: ChangeDirection;
  priceChange: number | null;
  priceChangePercent: number | null;
  volumeChangePercent: number | null;
  reasons: string[];
  warnings: string[];
  dataStatus: ComparisonDataStatus;
};

const attentionRank: Record<AttentionLevel, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

function isValidPrice(
  value: number | null,
): value is number {
  return (
    value !== null &&
    Number.isFinite(value) &&
    value > 0
  );
}

function qualityWarnings(
  snapshot: SnapshotForComparison,
  label: string,
): string[] {
  switch (snapshot.quoteQuality) {
    case "LIVE":
      return [];

    case "DELAYED":
      return [`${label} quote was marked delayed`];

    case "STALE":
      return [`${label} quote was marked stale`];

    case "CONFLICTED":
      return [`${label} quote has conflicting data`];

    case "INDICATIVE":
      return [`${label} price is indicative`];

    default:
      return [`${label} quote quality is unknown`];
  }
}

function freshnessWarnings(
  snapshot: SnapshotForComparison,
  label: string,
): string[] {
  switch (snapshot.freshnessStatus) {
    case "FRESH":
    case "MARKET_CLOSED":
      return [];

    case "AGING":
      return [
        `${label} quote was aging when captured`,
      ];

    case "STALE":
      return [
        `${label} quote was stale when captured`,
      ];

    case "DELAYED":
      return [
        `${label} quote was delayed when captured`,
      ];

    case "INDICATIVE":
      return [
        `${label} quote was indicative when captured`,
      ];

    case "CONFLICTED":
      return [
        `${label} quote was conflicted when captured`,
      ];

    default:
      return [
        `${label} snapshot freshness is unknown`,
      ];
  }
}

function snapshotWarnings(
  snapshot: SnapshotForComparison,
  label: string,
): string[] {
  const quality =
    qualityWarnings(snapshot, label);

  const freshness =
    freshnessWarnings(snapshot, label);

  const duplicateStatus =
    snapshot.quoteQuality ===
      snapshot.freshnessStatus &&
    [
      "DELAYED",
      "STALE",
      "INDICATIVE",
      "CONFLICTED",
    ].includes(
      snapshot.freshnessStatus,
    );

  if (duplicateStatus) {
    return freshness;
  }

  return [...quality, ...freshness];
}

function blocksComparison(
  snapshot: SnapshotForComparison,
  policy: ChangeDetectionPolicy,
): boolean {
  const qualityBlocks =
    policy.blockingQuoteQualities.includes(
      snapshot.quoteQuality ?? "UNKNOWN",
    );

  const freshnessBlocks =
    snapshot.freshnessStatus === "STALE" ||
    snapshot.freshnessStatus === "CONFLICTED";

  return qualityBlocks || freshnessBlocks;
}

function sourceFamily(source: string | null): string | null {
  if (!source) {
    return null;
  }

  if (source.startsWith("mock-")) {
    return "mock";
  }

  return source;
}

function sourceCompatibilityWarnings(
  current: SnapshotForComparison,
  baseline: SnapshotForComparison,
): string[] {
  const currentFamily = sourceFamily(current.quoteSource);
  const baselineFamily = sourceFamily(baseline.quoteSource);

  if (!currentFamily || !baselineFamily) {
    return [
      "Quote sources cannot be verified for both snapshots",
    ];
  }

  if (currentFamily !== baselineFamily) {
    return [
      `Quote sources are not comparable (${baseline.quoteSource} → ${current.quoteSource})`,
    ];
  }

  return [];
}

function unavailable(
  reasons: string[],
  warnings: string[],
): MeaningfulChange {
  return {
    attentionLevel: "NONE",
    score: 0,
    direction: "UNKNOWN",
    priceChange: null,
    priceChangePercent: null,
    volumeChangePercent: null,
    reasons,
    warnings,
    dataStatus: "UNAVAILABLE",
  };
}

export function calculateMeaningfulChange(
  current: SnapshotForComparison,
  baseline: SnapshotForComparison | null,
  policy: ChangeDetectionPolicy,
): MeaningfulChange {
  const warnings = snapshotWarnings(
  current,
  "Current",
);

  if (!isValidPrice(current.price)) {
    warnings.push("Current price is unavailable or invalid");
  }

  if (!baseline) {
    return unavailable(
      ["No baseline exists for this instrument"],
      warnings,
    );
  }

  warnings.push(
  ...snapshotWarnings(
    baseline,
    "Baseline",
  ),
);

  const sourceWarnings = sourceCompatibilityWarnings(
    current,
    baseline,
  );

  warnings.push(...sourceWarnings);

  if (!isValidPrice(baseline.price)) {
    warnings.push("Baseline price is unavailable or invalid");
  }

  if (
    !isValidPrice(current.price) ||
    !isValidPrice(baseline.price) ||
    blocksComparison(current, policy) ||
    blocksComparison(baseline, policy) ||
    sourceWarnings.length > 0
  ) {
    return unavailable(
      ["Price movement could not be assessed reliably"],
      warnings,
    );
  }

  const priceChange = current.price - baseline.price;
  const priceChangePercent =
    (priceChange / baseline.price) * 100;

  if (
    !Number.isFinite(priceChange) ||
    !Number.isFinite(priceChangePercent)
  ) {
    return unavailable(
      ["Price movement could not be calculated"],
      [...warnings, "Calculated price change is outside supported limits"],
    );
  }

  const magnitude = Math.abs(priceChangePercent);

  let attentionLevel: AttentionLevel = "NONE";

  if (
  magnitude >=
  policy.priceThresholds.highPercent
) {
  attentionLevel = "HIGH";
} else if (
  magnitude >=
  policy.priceThresholds.mediumPercent
) {
  attentionLevel = "MEDIUM";
} else if (
  magnitude >=
  policy.priceThresholds.lowPercent
) {
  attentionLevel = "LOW";
}

  const direction: ChangeDirection =
    priceChange > 0
      ? "UP"
      : priceChange < 0
        ? "DOWN"
        : "UNCHANGED";

  const reasons =
    attentionLevel === "NONE"
      ? ["Price movement is below the configured thresholds"]
      : [
          `Price ${priceChange > 0 ? "increased" : "decreased"} by ${magnitude.toFixed(2)}% since the previous review`,
        ];

  return {
    attentionLevel,
    score: Number(magnitude.toFixed(2)),
    direction,
    priceChange: Number(priceChange.toFixed(2)),
    priceChangePercent: Number(priceChangePercent.toFixed(2)),
    volumeChangePercent: null,
    reasons,
    warnings,
    dataStatus: warnings.length > 0 ? "LIMITED" : "AVAILABLE",
  };
}

export function getAttentionRank(
  level: AttentionLevel,
): number {
  return attentionRank[level];
}
