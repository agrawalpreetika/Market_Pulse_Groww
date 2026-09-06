import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";

import { prisma } from "../../src/infrastructure/database/prisma";
import { reviewService } from "../../src/modules/reviews/review.service";
import { watchlistService } from "../../src/modules/watchlists/watchlist.service";
import { AppError } from "../../src/shared/errors/app-error";

const ownerId = randomUUID();
const otherUserId = randomUUID();

async function expectAppError(
  operation: () => Promise<unknown>,
  expectedCode: string,
  expectedStatus: number,
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, expectedCode);
    assert.equal(error.statusCode, expectedStatus);
    return true;
  });
}

after(async () => {
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [ownerId, otherUserId],
      },
    },
  });

  await prisma.$disconnect();
});

test("watchlists and reviews are isolated by authenticated owner", async () => {
  await prisma.user.createMany({
    data: [
      {
        id: ownerId,
        email: `authorization-owner-${ownerId}@example.test`,
        name: "Authorization Owner",
      },
      {
        id: otherUserId,
        email: `authorization-other-${otherUserId}@example.test`,
        name: "Authorization Other User",
      },
    ],
  });

  const watchlist = await watchlistService.createForUser(
    ownerId,
    {
      name: "Private integration watchlist",
    },
  );

  const ownerWatchlist = await watchlistService.getForUser(
    ownerId,
    watchlist.id,
  );
  assert.equal(ownerWatchlist.id, watchlist.id);

  await expectAppError(
    () => watchlistService.getForUser(otherUserId, watchlist.id),
    "WATCHLIST_NOT_FOUND",
    404,
  );

  await expectAppError(
    () =>
      watchlistService.updateForUser(otherUserId, watchlist.id, {
        name: "Stolen watchlist",
        version: watchlist.version,
      }),
    "WATCHLIST_NOT_FOUND",
    404,
  );

  await expectAppError(
    () =>
      watchlistService.addItemForUser(otherUserId, watchlist.id, {
        instrumentId: randomUUID(),
      }),
    "WATCHLIST_NOT_FOUND",
    404,
  );

  await expectAppError(
    () => watchlistService.deleteForUser(otherUserId, watchlist.id),
    "WATCHLIST_NOT_FOUND",
    404,
  );

  const ownerStillHasWatchlist =
    await watchlistService.getForUser(ownerId, watchlist.id);
  assert.equal(ownerStillHasWatchlist.name, watchlist.name);

  await expectAppError(
    () =>
      reviewService.createOrReuseOpenReview(
        watchlist.id,
        otherUserId,
      ),
    "WATCHLIST_NOT_FOUND",
    404,
  );

  const { review } = await reviewService.createOrReuseOpenReview(
    watchlist.id,
    ownerId,
  );

  await expectAppError(
    () =>
      reviewService.getMeaningfulChanges(
        review.id,
        watchlist.id,
        otherUserId,
      ),
    "REVIEW_NOT_FOUND",
    404,
  );

  await expectAppError(
    () =>
      reviewService.acknowledge(
        review.id,
        watchlist.id,
        otherUserId,
        review.version,
      ),
    "REVIEW_NOT_FOUND",
    404,
  );
});
