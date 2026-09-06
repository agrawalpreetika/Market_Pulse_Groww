import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createResilientHttpClient,
  ProviderCircuitOpenError,
} from "../src/infrastructure/providers/resilient-http-client";

function testClient(overrides: {
  now?: () => number;
  failureThreshold?: number;
  openDurationMs?: number;
} = {}) {
  const delays: number[] = [];
  const client = createResilientHttpClient({
    name: "Test provider",
    maximumAttempts: 3,
    baseDelayMs: 100,
    maximumDelayMs: 1_000,
    random: () => 0.5,
    sleep: async (delay) => {
      delays.push(delay);
    },
    ...overrides,
  });

  return { client, delays };
}

test("temporary provider failures retry with exponential backoff", async () => {
  const { client, delays } = testClient();
  let calls = 0;

  const response = await client.fetch(
    "https://provider.test/quote",
    {},
    async () => {
      calls += 1;
      return new Response("temporary", {
        status: calls < 3 ? 503 : 200,
      });
    },
  );

  assert.equal(response.status, 200);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [50, 100]);
  assert.equal(client.getState(), "CLOSED");
});

test("permanent client errors are not retried", async () => {
  const { client, delays } = testClient();
  let calls = 0;

  const response = await client.fetch(
    "https://provider.test/missing",
    {},
    async () => {
      calls += 1;
      return new Response("missing", { status: 404 });
    },
  );

  assert.equal(response.status, 404);
  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
});

test("the circuit opens after repeated exhausted request cycles", async () => {
  const { client } = testClient({
    failureThreshold: 2,
  });
  let calls = 0;
  const unavailableFetch = async () => {
    calls += 1;
    return new Response("unavailable", { status: 503 });
  };

  await client.fetch("https://provider.test", {}, unavailableFetch);
  await client.fetch("https://provider.test", {}, unavailableFetch);

  assert.equal(client.getState(), "OPEN");
  assert.equal(calls, 6);

  await assert.rejects(
    () => client.fetch("https://provider.test", {}, unavailableFetch),
    ProviderCircuitOpenError,
  );
  assert.equal(calls, 6);
});

test("a successful half-open probe closes the circuit", async () => {
  let clock = 1_000;
  const { client } = testClient({
    failureThreshold: 1,
    openDurationMs: 5_000,
    now: () => clock,
  });

  await client.fetch(
    "https://provider.test",
    {},
    async () => new Response("unavailable", { status: 503 }),
  );
  assert.equal(client.getState(), "OPEN");

  clock += 5_000;
  const response = await client.fetch(
    "https://provider.test",
    {},
    async () => new Response("ok", { status: 200 }),
  );

  assert.equal(response.status, 200);
  assert.equal(client.getState(), "CLOSED");
});
