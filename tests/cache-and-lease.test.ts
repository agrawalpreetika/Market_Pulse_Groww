import assert from "node:assert/strict";
import { test } from "node:test";

import { discoveryCacheTtlSeconds } from "../src/infrastructure/cache/discovery-cache";
import { acquireLease } from "../src/infrastructure/coordination/distributed-lease";

test("successful discovery uses a longer TTL than an empty result", () => {
  const positiveTtl = discoveryCacheTtlSeconds({
    status: "AVAILABLE",
    instruments: [
      {
        source: "YAHOO",
        providerIdentifier: "INFY.NS",
        symbol: "INFY",
        name: "Infosys Limited",
        exchange: "NSE",
        instrumentType: "EQUITY",
        currency: "INR",
        status: "ACTIVE",
      },
    ],
  });
  const emptyTtl = discoveryCacheTtlSeconds({
    status: "AVAILABLE",
    instruments: [],
  });

  assert.equal(positiveTtl, 600);
  assert.equal(emptyTtl, 60);
  assert.ok(positiveTtl > emptyTtl);
});

test("provider outages are never cached as empty searches", () => {
  assert.equal(
    discoveryCacheTtlSeconds({
      status: "UNAVAILABLE",
      instruments: [],
    }),
    null,
  );
});

test("a lease cannot be acquired while another owner holds it", async () => {
  let owner: string | null = null;
  const store = {
    async set(_key: string, token: string) {
      if (owner !== null) return null;
      owner = token;
      return "OK";
    },
    async eval(_script: string, options: { arguments: string[] }) {
      if (owner !== options.arguments[0]) return 0;
      owner = null;
      return 1;
    },
  };

  const first = await acquireLease(store, "refresh", 1_000, "worker-a");
  const second = await acquireLease(store, "refresh", 1_000, "worker-b");

  assert.ok(first);
  assert.equal(second, null);
  assert.equal(await first.release(), true);

  const third = await acquireLease(store, "refresh", 1_000, "worker-b");
  assert.ok(third);
});
