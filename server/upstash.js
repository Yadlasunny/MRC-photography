import { Redis } from "@upstash/redis";

// Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from the
// environment — auto-populated by the Upstash for Redis integration
// connected in the Vercel dashboard's Storage tab.
export const redis = Redis.fromEnv();
