import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyOverallHealth } from "../src/modules/health/system-health";

test("database failure makes the service unhealthy", () => {
  assert.equal(
    classifyOverallHealth({
      databaseConnected: false,
      redisConfigured: true,
      redisConnected: true,
    }),
    "unhealthy",
  );
});

test("optional Redis failure degrades but does not stop the service", () => {
  assert.equal(
    classifyOverallHealth({
      databaseConnected: true,
      redisConfigured: true,
      redisConnected: false,
    }),
    "degraded",
  );
});

test("an intentionally unconfigured cache does not degrade health", () => {
  assert.equal(
    classifyOverallHealth({
      databaseConnected: true,
      redisConfigured: false,
      redisConnected: false,
    }),
    "healthy",
  );
});
