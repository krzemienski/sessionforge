import { Redis } from "@upstash/redis";

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? "https://placeholder.upstash.io";
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? "placeholder-token";

export const redis = new Redis({ url: redisUrl, token: redisToken });
