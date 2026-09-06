import { prisma } from "@/infrastructure/database/prisma";

type CreateWatchlistRecord = {
  userId: string;
  name: string;
  nameNormalized: string;
};

type AddWatchlistItemRecord = {
  watchlistId: string;
  instrumentId: string;
  userNote?: string;
  customThreshold?: number;
};

export const watchlistRepository = {
  findAllByUserId(userId: string) {
    return prisma.watchlist.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
  },

  findByNormalizedName(
    userId: string,
    nameNormalized: string,
  ) {
    return prisma.watchlist.findUnique({
      where: {
        userId_nameNormalized: {
          userId,
          nameNormalized,
        },
      },
    });
  },

  create(data: CreateWatchlistRecord) {
    return prisma.watchlist.create({
      data,
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });
  },
  
  findByIdForUser(id: string, userId: string) {
  return prisma.watchlist.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      items: {
        orderBy: [
          {
            displayOrder: "asc",
          },
          {
            addedAt: "asc",
          },
        ],
        include: {
  instrument: {
    include: {
      latestQuote: true,
    },
  },
},
      },
    },
  });
},

updateWithVersion(
  id: string,
  userId: string,
  currentVersion: number,
  data: {
    name: string;
    nameNormalized: string;
  },
) {
  return prisma.watchlist.updateMany({
    where: {
      id,
      userId,
      version: currentVersion,
    },
    data: {
      ...data,
      version: {
        increment: 1,
      },
    },
  });
},

deleteForUser(id: string, userId: string) {
  return prisma.watchlist.deleteMany({
    where: {
      id,
      userId,
    },
  });
    },

    findItem(
  watchlistId: string,
  instrumentId: string,
) {
  return prisma.watchlistItem.findUnique({
    where: {
      watchlistId_instrumentId: {
        watchlistId,
        instrumentId,
      },
    },
  });
},

async addItem(data: AddWatchlistItemRecord) {
  return prisma.$transaction(async (transaction) => {
    const displayOrderResult =
      await transaction.watchlistItem.aggregate({
        where: {
          watchlistId: data.watchlistId,
        },
        _max: {
          displayOrder: true,
        },
      });

    const nextDisplayOrder =
      (displayOrderResult._max.displayOrder ?? -1) + 1;

    const item =
      await transaction.watchlistItem.create({
        data: {
          watchlistId: data.watchlistId,
          instrumentId: data.instrumentId,
          userNote: data.userNote,
          customThreshold: data.customThreshold,
          displayOrder: nextDisplayOrder,
        },
        include: {
          instrument: true,
        },
      });

    await transaction.watchlist.update({
      where: {
        id: data.watchlistId,
      },
      data: {
        version: {
          increment: 1,
        },
      },
    });

    return item;
  });
},

async removeItem(
  watchlistId: string,
  instrumentId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const result =
      await transaction.watchlistItem.deleteMany({
        where: {
          watchlistId,
          instrumentId,
        },
      });

    if (result.count > 0) {
      await transaction.watchlist.update({
        where: {
          id: watchlistId,
        },
        data: {
          version: {
            increment: 1,
          },
        },
      });
    }

    return result;
  });
},
};

