export type OverallHealth = "healthy" | "degraded" | "unhealthy";

export function classifyOverallHealth(input: {
  databaseConnected: boolean;
  redisConfigured: boolean;
  redisConnected: boolean;
}): OverallHealth {
  if (!input.databaseConnected) return "unhealthy";
  if (input.redisConfigured && !input.redisConnected) return "degraded";
  return "healthy";
}
