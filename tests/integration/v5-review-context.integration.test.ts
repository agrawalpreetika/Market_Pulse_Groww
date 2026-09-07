import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";

import { prisma } from "../../src/infrastructure/database/prisma";
import { reviewRepository } from "../../src/modules/reviews/review.repository";

test("V5 freezes completed daily evidence into a new review", async () => {
  const userId = randomUUID();
  const watchlistId = randomUUID();
  const instrumentId = randomUUID();
  const now = new Date();

  try {
    await prisma.user.create({
      data: { id: userId, email: `v5-${userId}@example.test`, name: "V5 Test" },
    });
    await prisma.instrument.create({
      data: {
        id: instrumentId,
        symbol: `V5${instrumentId.slice(0, 6)}`,
        name: "V5 history fixture",
        exchange: "NSE",
        instrumentType: "EQUITY",
        currency: "INR",
        timezone: "Asia/Kolkata",
      },
    });
    await prisma.watchlist.create({
      data: {
        id: watchlistId,
        userId,
        name: "V5 Test List",
        nameNormalized: `v5-${watchlistId}`,
        items: { create: { instrumentId } },
      },
    });
    await prisma.latestQuote.create({
      data: {
        instrumentId,
        price: "100",
        previousClose: "99",
        volume: BigInt(10_000),
        session: "CLOSED",
        quality: "DELAYED",
        source: "yahoo-finance-unofficial",
        providerTimestamp: new Date(now.getTime() - 60_000),
        receivedAt: now,
      },
    });

    for (let offset = 20; offset >= 1; offset -= 1) {
      const tradingDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - offset,
      ));
      const close = 90 + (20 - offset) * 0.5 + (offset % 2 === 0 ? 0.2 : -0.2);
      await prisma.dailyPriceBar.create({
        data: {
          instrumentId,
          tradingDate,
          open: String(close - 0.25),
          high: String(close + 0.75),
          low: String(close - 0.75),
          close: String(close),
          adjustedClose: String(close),
          volume: BigInt(10_000 + offset * 100),
          adjustment: "RAW_WITH_ADJUSTED_CLOSE",
          source: "yahoo-finance-unofficial",
          providerTimestamp: tradingDate,
          receivedAt: new Date(now.getTime() - 1_000),
        },
      });
    }

    const first = await reviewRepository.createOrReuseOpenReview(watchlistId, userId);
    assert.ok(first?.review);
    await reviewRepository.acknowledge(
      first.review.id,
      watchlistId,
      userId,
      first.review.version,
    );
    await prisma.latestQuote.update({
      where: { instrumentId },
      data: {
        price: "103",
        providerTimestamp: new Date(),
        receivedAt: new Date(),
      },
    });

    const second = await reviewRepository.createOrReuseOpenReview(watchlistId, userId);
    assert.ok(second?.review);
    const snapshot = second.review.items[0];
    assert.equal(second.review.policyVersion, "daily-context-v5");
    assert.equal(snapshot.referenceSampleCount, 20);
    assert.ok(snapshot.referenceVolatilityPercent !== null);
    assert.equal(snapshot.referenceHorizonSessions, 1);
    assert.equal(snapshot.referenceSource, "yahoo-finance-unofficial");
    assert.equal(snapshot.referencePriceBasis, "ADJUSTED_CLOSE");
    assert.ok(snapshot.referenceHigh !== null);
    assert.ok(snapshot.referenceMedianVolume !== null);
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.instrument.deleteMany({ where: { id: instrumentId } });
  }
});

after(async () => {
  await prisma.$disconnect();
});
