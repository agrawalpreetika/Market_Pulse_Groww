export type ChangeDetectionPolicy = {
  version: string;
  displayName: string;

  priceThresholds: {
    lowPercent: number;
    mediumPercent: number;
    highPercent: number;
  };

  blockingQuoteQualities: readonly string[];
  supportsCustomThresholds: boolean;
  supportsSessionReversal: boolean;
  supportsHistoricalContext: boolean;
  usesCompletedDailyHistory: boolean;
};

export const CURRENT_CHANGE_POLICY_VERSION =
  "daily-context-v5";

const priceMovementV1: ChangeDetectionPolicy = {
  version: "price-movement-v1",
  displayName: "Price Movement MVP v1",

  priceThresholds: {
    lowPercent: 1,
    mediumPercent: 2,
    highPercent: 4,
  },

  blockingQuoteQualities: [
    "STALE",
    "CONFLICTED",
  ],
  supportsCustomThresholds: false,
  supportsSessionReversal: false,
  supportsHistoricalContext: false,
  usesCompletedDailyHistory: false,
};

const priceContextV2: ChangeDetectionPolicy = {
  ...priceMovementV1,
  version: "price-context-v2",
  displayName: "Context-aware Price Movement v2",
  supportsCustomThresholds: true,
  supportsSessionReversal: true,
  supportsHistoricalContext: false,
};

const historicalContextV3: ChangeDetectionPolicy = {
  ...priceContextV2,
  version: "historical-context-v3",
  displayName: "Historical Context v3",
  supportsHistoricalContext: true,
};

const policyRegistry: Record<
  string,
  ChangeDetectionPolicy
> = {
  [priceMovementV1.version]: priceMovementV1,
  [priceContextV2.version]: priceContextV2,
  [historicalContextV3.version]: historicalContextV3,
  "observed-context-v4": {
    ...historicalContextV3,
    version: "observed-context-v4",
    displayName: "Observed Price Context v4",
  },
  "daily-context-v5": {
    ...historicalContextV3,
    version: "daily-context-v5",
    displayName: "Completed Daily Context v5",
    usesCompletedDailyHistory: true,
  },
};

export function getChangeDetectionPolicy(
  version: string,
): ChangeDetectionPolicy {
  const policy = policyRegistry[version];

  if (!policy) {
    throw new Error(
      `Unsupported change-detection policy: ${version}`,
    );
  }

  return policy;
}

export function getCurrentChangeDetectionPolicy():
  ChangeDetectionPolicy {
  return getChangeDetectionPolicy(
    CURRENT_CHANGE_POLICY_VERSION,
  );
}
