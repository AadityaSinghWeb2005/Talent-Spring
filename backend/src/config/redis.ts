import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

redis.on("error", (error) => {
  process.stderr.write(`Redis error: ${error instanceof Error ? error.message : "unknown"}\n`);
});
