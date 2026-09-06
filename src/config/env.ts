export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  marketDataProvider:
    process.env.MARKET_DATA_PROVIDER ?? "mock",
};