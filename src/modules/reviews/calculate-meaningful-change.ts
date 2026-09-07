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
  previousClose?: number | null;
  volume: bigint | null;
  quoteQuality: string | null;
  quoteSource: string | null;
  freshnessStatus: string;
  quoteAgeSeconds: number | null;
  customThresholdPercent?: number | null;
  marketSession?: string | null;
  referenceSampleCount?: number;
  referenceVolatilityPercent?: number | null;
  referenceHigh?: number | null;
  referenceLow?: number | null;
  referenceMedianVolume?: bigint | null;
  referenceVolumeSampleCount?: number;
  referenceHorizonSessions?: number;
  referenceSource?: string | null;
  referencePriceBasis?: "NONE" | "ADJUSTED_CLOSE";
};

export type SignalConfidence = "HIGH" | "MEDIUM" | "LOW";

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
  policy: ChangeDetectionPolicy,
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
    confidence: "LOW",
    appliedThresholds: policy.priceThresholds,
    signals: [],
    volatilityMultiple: null,
    volumeMultiple: null,
    rangeBreakout: null,
  };
}

function resolveThresholds(
  current: SnapshotForComparison,
  policy: ChangeDetectionPolicy,
): ChangeDetectionPolicy["priceThresholds"] {
  const custom = current.customThresholdPercent;

  if (
    !policy.supportsCustomThresholds ||
    custom === null ||
    custom === undefined ||
    !Number.isFinite(custom) ||
    custom <= 0
  ) {
    return policy.priceThresholds;
  }

  return {
    lowPercent: custom,
    mediumPercent: Math.min(custom * 2, 100),
    highPercent: Math.min(custom * 4, 100),
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
      policy,
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
      policy,
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
      policy,
    );
  }

  const magnitude = Math.abs(priceChangePercent);
  const thresholds = resolveThresholds(current, policy);

  let attentionLevel: AttentionLevel = "NONE";

  if (
  magnitude >=
  thresholds.highPercent
) {
  attentionLevel = "HIGH";
} else if (
  magnitude >=
  thresholds.mediumPercent
) {
  attentionLevel = "MEDIUM";
} else if (
  magnitude >=
  thresholds.lowPercent
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

  const signals = ["REVIEW_PERIOD_PRICE_MOVE"];
  let volatilityMultiple: number | null = null;
  let volumeMultiple: number | null = null;
  let rangeBreakout: "UP" | "DOWN" | null = null;
  const previousClose = current.previousClose ?? null;

  if (
    policy.supportsSessionReversal &&
    isValidPrice(previousClose)
  ) {
    const sessionChange = current.price - previousClose;
    const sessionChangePercent =
      (sessionChange / previousClose) * 100;

    if (
      Number.isFinite(sessionChangePercent) &&
      Math.abs(sessionChangePercent) >= thresholds.lowPercent &&
      Math.sign(sessionChange) !== 0 &&
      Math.sign(priceChange) !== 0 &&
      Math.sign(sessionChange) !== Math.sign(priceChange)
    ) {
      signals.push("SESSION_DIRECTION_REVERSAL");
      reasons.push(
        "Current-session direction reversed the movement since the previous review",
      );
    }
  }

  if (policy.supportsHistoricalContext) {
    const observedOnly = policy.version === "observed-context-v4";
    if (observedOnly) {
      warnings.push("Volatility and abnormal volume are not assessed: verified daily closes and completed-session volumes are unavailable");
    }
    const sampleCount = current.referenceSampleCount ?? 0;
    const volatility = current.referenceVolatilityPercent ?? null;
    const dailyContext = policy.usesCompletedDailyHistory;

    if (dailyContext && sampleCount < 10) {
      warnings.push(
        `Historical signals need at least 10 completed daily sessions; ${sampleCount} are available`,
      );
    }

    if (dailyContext && sampleCount === 10) {
      warnings.push(
        "Volatility needs at least 11 completed daily sessions",
      );
    }

    if (
      dailyContext &&
      current.referencePriceBasis !== "ADJUSTED_CLOSE"
    ) {
      warnings.push(
        "Volatility is unavailable because adjusted-close coverage is incomplete",
      );
    }

    if (
      dailyContext &&
      sampleCount >= 11 &&
      current.referencePriceBasis === "ADJUSTED_CLOSE" &&
      (current.referenceHorizonSessions ?? 0) === 0
    ) {
      warnings.push(
        "Review-horizon volatility is unavailable because history does not cover the baseline date",
      );
    }

    if (
      !observedOnly && sampleCount >= 11 &&
      volatility !== null &&
      Number.isFinite(volatility) &&
      volatility > 0
    ) {
      volatilityMultiple = Number(
        (magnitude / Math.max(volatility, 0.25)).toFixed(2),
      );

      if (
        magnitude >= thresholds.lowPercent &&
        volatilityMultiple >= 2
      ) {
        signals.push("VOLATILITY_ADJUSTED_MOVE");
        reasons.push(
          dailyContext
            ? `Movement was ${volatilityMultiple.toFixed(2)}× the expected volatility for ${current.referenceHorizonSessions ?? 0} review-period session(s)`
            : `Movement was ${volatilityMultiple.toFixed(2)}× the recent daily volatility`,
        );

        const contextualLevel: AttentionLevel =
          volatilityMultiple >= 4
            ? "HIGH"
            : volatilityMultiple >= 3
              ? "MEDIUM"
              : "LOW";

        if (attentionRank[contextualLevel] > attentionRank[attentionLevel]) {
          attentionLevel = contextualLevel;
        }
      }
    }

    if (
      sampleCount >= 10 &&
      magnitude >= thresholds.lowPercent
    ) {
      const recentHigh = current.referenceHigh ?? null;
      const recentLow = current.referenceLow ?? null;

      if (isValidPrice(recentHigh) && current.price > recentHigh) {
        rangeBreakout = "UP";
      } else if (isValidPrice(recentLow) && current.price < recentLow) {
        rangeBreakout = "DOWN";
      }

      if (rangeBreakout) {
        signals.push("RECENT_RANGE_BREAKOUT");
        reasons.push(
          observedOnly
            ? `Price crossed ${rangeBreakout === "UP" ? "above" : "below"} the range of sampled prior prices; this is not a verified session high/low breakout`
            : `Price broke ${rangeBreakout === "UP" ? "above" : "below"} its frozen recent trading range`,
        );
        if (attentionRank[attentionLevel] < attentionRank.MEDIUM) {
          attentionLevel = "MEDIUM";
        }
      }
    }

    const medianVolume = current.referenceMedianVolume ?? null;
    if (
      !observedOnly && current.marketSession === "CLOSED" &&
      (current.referenceVolumeSampleCount ?? 0) >= 10 &&
      current.volume !== null &&
      medianVolume !== null &&
      medianVolume > 0 &&
      current.volume >= 0
    ) {
      volumeMultiple = Number(
        (Number(current.volume) / Number(medianVolume)).toFixed(2),
      );

      if (
        Number.isFinite(volumeMultiple) &&
        volumeMultiple >= 2 &&
        magnitude >= thresholds.lowPercent
      ) {
        signals.push("ABNORMAL_CLOSED_SESSION_VOLUME");
        reasons.push(
          `Closed-session volume was ${volumeMultiple.toFixed(2)}× its recent median`,
        );
        if (attentionRank[attentionLevel] < attentionRank.LOW) {
          attentionLevel = "LOW";
        }
      }
    }
  }

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
    confidence: warnings.length > 0 ? "MEDIUM" : "HIGH",
    appliedThresholds: thresholds,
    signals,
    volatilityMultiple,
    volumeMultiple,
    rangeBreakout,
  };
}

export function getAttentionRank(
  level: AttentionLevel,
): number {
  return attentionRank[level];
}
