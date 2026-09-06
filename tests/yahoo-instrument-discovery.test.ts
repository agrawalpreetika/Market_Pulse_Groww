import assert from "node:assert/strict";
import { test } from "node:test";

import { yahooInstrumentDiscoveryProvider } from "../src/infrastructure/providers/yahoo-instrument-discovery-provider";

test("Yahoo discovery normalizes Indian equities and removes duplicates", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    new Response(
      JSON.stringify({
        quotes: [
          {
            symbol: "HDFCBANK.NS",
            longname: "HDFC Bank Limited",
            quoteType: "EQUITY",
          },
          {
            symbol: "HDFCBANK.NS",
            shortname: "HDFC BANK LTD",
            quoteType: "EQUITY",
          },
          {
            symbol: "HDBK-U2624.BO",
            quoteType: "FUTURE",
          },
          {
            symbol: "AAPL",
            quoteType: "EQUITY",
          },
        ],
      }),
      { status: 200 },
    ),
  );

  const result =
    await yahooInstrumentDiscoveryProvider.searchWithStatus(
      "HDFCBANK",
      10,
    );

  assert.equal(result.status, "AVAILABLE");
  assert.equal(result.instruments.length, 1);
  assert.deepEqual(result.instruments[0], {
    source: "YAHOO",
    providerIdentifier: "HDFCBANK.NS",
    symbol: "HDFCBANK",
    name: "HDFC Bank Limited",
    exchange: "NSE",
    instrumentType: "EQUITY",
    currency: "INR",
    status: "ACTIVE",
  });
});

test("a genuine empty Yahoo result remains available", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ quotes: [] }), {
      status: 200,
    }),
  );

  const result =
    await yahooInstrumentDiscoveryProvider.searchWithStatus(
      "NO-SUCH-INSTRUMENT",
      10,
    );

  assert.equal(result.status, "AVAILABLE");
  assert.deepEqual(result.instruments, []);
});

test("a Yahoo HTTP failure is reported as unavailable", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    new Response("rate limited", { status: 429 }),
  );

  const result =
    await yahooInstrumentDiscoveryProvider.searchWithStatus(
      "INFY",
      10,
    );

  assert.equal(result.status, "UNAVAILABLE");
  assert.deepEqual(result.instruments, []);
});

test("invalid Yahoo JSON is reported as unavailable", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    new Response("not-json", { status: 200 }),
  );

  const result =
    await yahooInstrumentDiscoveryProvider.searchWithStatus(
      "INFY",
      10,
    );

  assert.equal(result.status, "UNAVAILABLE");
  assert.deepEqual(result.instruments, []);
});

test("an invalid Yahoo response shape is reported as unavailable", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ unexpected: true }), {
      status: 200,
    }),
  );

  const result =
    await yahooInstrumentDiscoveryProvider.searchWithStatus(
      "INFY",
      10,
    );

  assert.equal(result.status, "UNAVAILABLE");
  assert.deepEqual(result.instruments, []);
});

test("a Yahoo network failure is reported as unavailable", async (context) => {
  context.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("network unavailable");
  });

  const result =
    await yahooInstrumentDiscoveryProvider.searchWithStatus(
      "INFY",
      10,
    );

  assert.equal(result.status, "UNAVAILABLE");
  assert.deepEqual(result.instruments, []);
});
