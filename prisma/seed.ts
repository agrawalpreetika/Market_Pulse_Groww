import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: "demo@marketpulse.local",
    },
    update: {
      name: "Demo User",
      timezone: "Asia/Kolkata",
    },
    create: {
      email: "demo@marketpulse.local",
      name: "Demo User",
      timezone: "Asia/Kolkata",
    },
  });

  const instruments = await Promise.all([
    prisma.instrument.upsert({
      where: {
        exchange_symbol_instrumentType: {
          exchange: "NSE",
          symbol: "INFY",
          instrumentType: "EQUITY",
        },
      },
      update: {
        name: "Infosys Limited",
        currency: "INR",
        timezone: "Asia/Kolkata",
        status: "ACTIVE",
        providerIdentifier: "INFY:NSE",
      },
      create: {
        exchange: "NSE",
        symbol: "INFY",
        name: "Infosys Limited",
        instrumentType: "EQUITY",
        currency: "INR",
        timezone: "Asia/Kolkata",
        providerIdentifier: "INFY:NSE",
      },
    }),

    prisma.instrument.upsert({
      where: {
        exchange_symbol_instrumentType: {
          exchange: "NSE",
          symbol: "TCS",
          instrumentType: "EQUITY",
        },
      },
      update: {
        name: "Tata Consultancy Services Limited",
        currency: "INR",
        timezone: "Asia/Kolkata",
        status: "ACTIVE",
        providerIdentifier: "TCS:NSE",
      },
      create: {
        exchange: "NSE",
        symbol: "TCS",
        name: "Tata Consultancy Services Limited",
        instrumentType: "EQUITY",
        currency: "INR",
        timezone: "Asia/Kolkata",
        providerIdentifier: "TCS:NSE",
      },
    }),

    prisma.instrument.upsert({
      where: {
        exchange_symbol_instrumentType: {
          exchange: "NSE",
          symbol: "WIPRO",
          instrumentType: "EQUITY",
        },
      },
      update: {
        name: "Wipro Limited",
        currency: "INR",
        timezone: "Asia/Kolkata",
        status: "ACTIVE",
        providerIdentifier: "WIPRO:NSE",
      },
      create: {
        exchange: "NSE",
        symbol: "WIPRO",
        name: "Wipro Limited",
        instrumentType: "EQUITY",
        currency: "INR",
        timezone: "Asia/Kolkata",
        providerIdentifier: "WIPRO:NSE",
      },
    }),
  ]);

  const watchlist = await prisma.watchlist.upsert({
    where: {
      userId_nameNormalized: {
        userId: user.id,
        nameNormalized: "it stocks",
      },
    },
    update: {
      name: "IT Stocks",
    },
    create: {
      userId: user.id,
      name: "IT Stocks",
      nameNormalized: "it stocks",
    },
  });

  for (const [index, instrument] of instruments.entries()) {
    await prisma.watchlistItem.upsert({
      where: {
        watchlistId_instrumentId: {
          watchlistId: watchlist.id,
          instrumentId: instrument.id,
        },
      },
      update: {
        displayOrder: index,
      },
      create: {
        watchlistId: watchlist.id,
        instrumentId: instrument.id,
        displayOrder: index,
      },
    });
  }

  console.log({
    user: user.email,
    watchlist: watchlist.name,
    instruments: instruments.map(
      (instrument) => instrument.symbol,
    ),
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });