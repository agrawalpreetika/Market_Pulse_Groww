import { prisma } from "@/infrastructure/database/prisma";

export const instrumentRepository = {
  findById(id: string) {
    return prisma.instrument.findUnique({
      where: {
        id,
      },
    });
  },
  
  upsertDiscoveredInstrument(input: {
  symbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  providerIdentifier: string;
}) {
  return prisma.instrument.upsert({
    where: {
      exchange_symbol_instrumentType: {
        exchange: input.exchange,
        symbol: input.symbol,
        instrumentType: "EQUITY",
      },
    },

    create: {
      symbol: input.symbol,
      name: input.name,
      exchange: input.exchange,
      instrumentType: "EQUITY",
      currency: "INR",
      timezone: "Asia/Kolkata",
      providerIdentifier:
        input.providerIdentifier,
      status: "ACTIVE",
    },

    update: {
      name: input.name,
      currency: "INR",
      timezone: "Asia/Kolkata",
      providerIdentifier:
        input.providerIdentifier,
    },
  });
},
    
    search(query: string, limit: number) {
  return prisma.instrument.findMany({
    where: {
      status: "ACTIVE",

      OR: [
        {
          symbol: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          name: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    },

    select: {
      id: true,
      symbol: true,
      name: true,
      exchange: true,
      instrumentType: true,
      currency: true,
      status: true,
    },

    orderBy: [
      {
        symbol: "asc",
      },
      {
        exchange: "asc",
      },
    ],

    take: limit,
  });
  },
    findActivelyWatched() {
  return prisma.instrument.findMany({
    where: {
      status: "ACTIVE",

      watchlistItems: {
        some: {},
      },
    },

    select: {
      id: true,
      symbol: true,
      exchange: true,
      providerIdentifier: true,
    },

    orderBy: [
      {
        exchange: "asc",
      },
      {
        symbol: "asc",
      },
    ],
  });
  },
    
    
};