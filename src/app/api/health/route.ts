import { getRedisClient } from "@/infrastructure/cache/redis";
import { prisma } from "@/infrastructure/database/prisma";
import { yahooHttpClient } from "@/infrastructure/providers/resilient-http-client";
import { classifyOverallHealth } from "@/modules/health/system-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let databaseConnected = false;
  let latestQuoteAt: Date | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
    const latest = await prisma.latestQuote.aggregate({
      _max: { providerTimestamp: true },
    });
    latestQuoteAt = latest._max.providerTimestamp;
  } catch {
    databaseConnected = false;
  }

  const redisConfigured = Boolean(process.env.REDIS_URL?.trim());
  let redisConnected = false;
  if (redisConfigured) {
    try {
      const client = await getRedisClient();
      redisConnected = client ? (await client.ping()) === "PONG" : false;
    } catch {
      redisConnected = false;
    }
  }

  const status = classifyOverallHealth({
    databaseConnected,
    redisConfigured,
    redisConnected,
  });
  const checkedAt = new Date();
  const latestQuoteAgeSeconds = latestQuoteAt
    ? Math.max(0, Math.floor((checkedAt.getTime() - latestQuoteAt.getTime()) / 1_000))
    : null;

  return Response.json(
    {
      status,
      checkedAt: checkedAt.toISOString(),
      durationMs: Date.now() - startedAt,
      components: {
        database: databaseConnected ? "connected" : "disconnected",
        redis: !redisConfigured
          ? "not_configured"
          : redisConnected
            ? "connected"
            : "disconnected",
        yahooCircuit: yahooHttpClient.getState().toLowerCase(),
      },
      marketData: {
        provider: process.env.MARKET_DATA_PROVIDER ?? "mock",
        latestQuoteAt: latestQuoteAt?.toISOString() ?? null,
        latestQuoteAgeSeconds,
      },
    },
    {
      status: databaseConnected ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
