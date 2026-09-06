import { createClient, type RedisClientType } from "redis";

let clientPromise: Promise<RedisClientType | null> | null = null;

export async function getRedisClient(): Promise<RedisClientType | null> {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (!redisUrl) {
    return null;
  }

  if (!clientPromise) {
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 1_500,
        reconnectStrategy: false,
      },
    });

    client.on("error", (error) => {
      console.warn("Redis client error", error);
    });

    clientPromise = client
      .connect()
      .then(() => client as RedisClientType)
      .catch(async (error: unknown) => {
        console.warn("Redis is unavailable; continuing without it", error);

        if (client.isOpen) {
          await client.close().catch(() => undefined);
        }

        clientPromise = null;
        return null;
      });
  }

  return clientPromise;
}

export async function disconnectRedis(): Promise<void> {
  const client = await clientPromise;
  clientPromise = null;

  if (client?.isOpen) {
    await client.close();
  }
}
