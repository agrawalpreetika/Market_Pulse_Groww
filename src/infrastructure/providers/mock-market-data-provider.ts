import type { MarketDataProvider } from "@/modules/market-data/market-data-provider";
import type {
  MarketDataInstrument,
  ProviderQuote,
} from "@/modules/market-data/market-data.types";

type MockMarketScenario = "baseline" | "moved";

type MockQuoteValues = {
  price: string;
  previousClose: string;
  open: string;
  high: string;
  low: string;
  volume: bigint;
};

const BASELINE_QUOTES: Record<
  string,
  MockQuoteValues
> = {
  INFY: {
    price: "1534.20",
    previousClose: "1480.00",
    open: "1492.00",
    high: "1540.00",
    low: "1485.50",
    volume: BigInt(2_800_000),
  },

  TCS: {
    price: "3625.50",
    previousClose: "3600.00",
    open: "3608.00",
    high: "3642.00",
    low: "3595.00",
    volume: BigInt(1_350_000),
  },

  WIPRO: {
    price: "251.75",
    previousClose: "250.00",
    open: "250.50",
    high: "253.10",
    low: "249.40",
    volume: BigInt(4_200_000),
  },
};

const MOVED_QUOTES: Record<
  string,
  MockQuoteValues
> = {
  INFY: {
    price: "1605.00",
    previousClose: "1480.00",
    open: "1538.00",
    high: "1612.00",
    low: "1530.00",
    volume: BigInt(4_500_000),
  },

  TCS: {
    price: "3610.00",
    previousClose: "3600.00",
    open: "3622.00",
    high: "3635.00",
    low: "3590.00",
    volume: BigInt(1_400_000),
  },

  WIPRO: {
    price: "238.50",
    previousClose: "250.00",
    open: "249.00",
    high: "249.50",
    low: "236.80",
    volume: BigInt(7_100_000),
  },
};

const FALLBACK_QUOTE: MockQuoteValues = {
  price: "100.00",
  previousClose: "99.00",
  open: "99.50",
  high: "101.00",
  low: "98.75",
  volume: BigInt(100_000),
};

function getScenario(): MockMarketScenario {
  const configuredScenario = (
    process.env.MOCK_MARKET_SCENARIO ??
    "baseline"
  )
    .trim()
    .toLocaleLowerCase("en");

  if (configuredScenario === "moved") {
    return "moved";
  }

  return "baseline";
}

function getQuotesForScenario(
  scenario: MockMarketScenario,
): Record<string, MockQuoteValues> {
  if (scenario === "moved") {
    return MOVED_QUOTES;
  }

  return BASELINE_QUOTES;
}

export class MockMarketDataProvider
  implements MarketDataProvider
{
  async getQuotes(
    instruments: MarketDataInstrument[],
  ): Promise<ProviderQuote[]> {
    const scenario = getScenario();
    const scenarioQuotes =
      getQuotesForScenario(scenario);

    const timestamp = new Date();

    return instruments.map((instrument) => {
      const values =
        scenarioQuotes[instrument.symbol] ??
        FALLBACK_QUOTE;

      return {
        instrumentId: instrument.id,

        price: values.price,
        previousClose: values.previousClose,
        open: values.open,
        high: values.high,
        low: values.low,
        volume: values.volume,

        session: "REGULAR",
        quality: "LIVE",
        source: `mock-${scenario}`,

        providerTimestamp: timestamp,
        receivedAt: new Date(),
      };
    });
  }
}