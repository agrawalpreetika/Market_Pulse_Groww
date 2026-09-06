import type { InstrumentDiscoveryResult } from "@/infrastructure/providers/yahoo-instrument-discovery-provider";

import {
  cacheKey,
  readCachedJson,
  writeCachedJson,
} from "./json-cache";

const POSITIVE_DISCOVERY_TTL_SECONDS = 10 * 60;
const EMPTY_DISCOVERY_TTL_SECONDS = 60;

export function discoveryCacheTtlSeconds(
  result: InstrumentDiscoveryResult,
): number | null {
  if (result.status !== "AVAILABLE") {
    return null;
  }

  return result.instruments.length > 0
    ? POSITIVE_DISCOVERY_TTL_SECONDS
    : EMPTY_DISCOVERY_TTL_SECONDS;
}

function discoveryCacheKey(query: string, limit: number): string {
  return cacheKey(
    "instrument-discovery",
    encodeURIComponent(query.trim().toLocaleLowerCase("en")),
    String(limit),
  );
}

export async function readDiscoveryCache(
  query: string,
  limit: number,
): Promise<InstrumentDiscoveryResult | null> {
  return readCachedJson<InstrumentDiscoveryResult>(
    discoveryCacheKey(query, limit),
  );
}

export async function writeDiscoveryCache(
  query: string,
  limit: number,
  result: InstrumentDiscoveryResult,
): Promise<void> {
  const ttlSeconds = discoveryCacheTtlSeconds(result);

  if (ttlSeconds === null) {
    return;
  }

  await writeCachedJson(
    discoveryCacheKey(query, limit),
    result,
    ttlSeconds,
  );
}
