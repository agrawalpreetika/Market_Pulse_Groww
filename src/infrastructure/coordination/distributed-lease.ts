import { randomUUID } from "node:crypto";

import { getRedisClient } from "@/infrastructure/cache/redis";

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

const RENEW_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0
`;

type LeaseStore = {
  set(
    key: string,
    value: string,
    options: { NX: true; PX: number },
  ): Promise<string | null>;
  eval(
    script: string,
    options: {
      keys: string[];
      arguments: string[];
    },
  ): Promise<unknown>;
};

export type DistributedLease = {
  renew(): Promise<boolean>;
  release(): Promise<boolean>;
};

export async function acquireLease(
  store: LeaseStore,
  key: string,
  ttlMs: number,
  token: string = randomUUID(),
): Promise<DistributedLease | null> {
  const acquired = await store.set(key, token, {
    NX: true,
    PX: ttlMs,
  });

  if (acquired !== "OK") {
    return null;
  }

  return {
    async renew() {
      const result = await store.eval(RENEW_SCRIPT, {
        keys: [key],
        arguments: [token, String(ttlMs)],
      });
      return Number(result) === 1;
    },

    async release() {
      const result = await store.eval(RELEASE_SCRIPT, {
        keys: [key],
        arguments: [token],
      });
      return Number(result) === 1;
    },
  };
}

export type LeaseRunResult<T> =
  | { outcome: "COMPLETED"; value: T }
  | { outcome: "COMPLETED_WITHOUT_REDIS"; value: T }
  | { outcome: "LOCKED" };

export async function runWithDistributedLease<T>(input: {
  key: string;
  ttlMs: number;
  task: () => Promise<T>;
}): Promise<LeaseRunResult<T>> {
  const client = await getRedisClient();

  if (!client) {
    return {
      outcome: "COMPLETED_WITHOUT_REDIS",
      value: await input.task(),
    };
  }

  let lease: DistributedLease | null;

  try {
    lease = await acquireLease(client, input.key, input.ttlMs);
  } catch (error: unknown) {
    console.warn("Redis lease acquisition failed; running locally", error);
    return {
      outcome: "COMPLETED_WITHOUT_REDIS",
      value: await input.task(),
    };
  }

  if (!lease) {
    return { outcome: "LOCKED" };
  }

  const renewalTimer = setInterval(() => {
    void lease?.renew().catch((error: unknown) => {
      console.warn("Redis lease renewal failed", error);
    });
  }, Math.max(1_000, Math.floor(input.ttlMs / 3)));
  renewalTimer.unref();

  try {
    return {
      outcome: "COMPLETED",
      value: await input.task(),
    };
  } finally {
    clearInterval(renewalTimer);
    await lease.release().catch((error: unknown) => {
      console.warn("Redis lease release failed", error);
    });
  }
}
