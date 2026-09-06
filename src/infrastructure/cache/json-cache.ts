import { getRedisClient } from "./redis";

const CACHE_PREFIX = "market-pulse:v1";

export function cacheKey(...parts: string[]): string {
  return [CACHE_PREFIX, ...parts].join(":");
}

export async function readCachedJson<T>(
  key: string,
): Promise<T | null> {
  try {
    const client = await getRedisClient();
    const value = await client?.get(key);

    return value ? (JSON.parse(value) as T) : null;
  } catch (error: unknown) {
    console.warn(`Redis cache read failed for ${key}`, error);
    return null;
  }
}

export async function writeCachedJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    const client = await getRedisClient();

    if (!client) {
      return;
    }

    await client.set(key, JSON.stringify(value), {
      EX: ttlSeconds,
    });
  } catch (error: unknown) {
    console.warn(`Redis cache write failed for ${key}`, error);
  }
}
