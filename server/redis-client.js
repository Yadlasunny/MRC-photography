import { createClient } from "redis";

// Lazily connect once, then reuse the same connection across requests on a
// warm serverless instance (a fresh TCP connection per request would be
// far too slow, and node-redis' client is meant to be long-lived).
let clientPromise;

export function getRedisClient() {
  if (!clientPromise) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err) => console.error("Redis client error:", err));
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}
