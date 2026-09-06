export type ChangeDetectionPolicy = {
  version: string;
  displayName: string;

  priceThresholds: {
    lowPercent: number;
    mediumPercent: number;
    highPercent: number;
  };

  blockingQuoteQualities: readonly string[];
};

export const CURRENT_CHANGE_POLICY_VERSION =
  "price-movement-v1";

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
};

const policyRegistry: Record<
  string,
  ChangeDetectionPolicy
> = {
  [priceMovementV1.version]: priceMovementV1,
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