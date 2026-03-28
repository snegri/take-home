import Redis from "ioredis"
import { config } from "./config"

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
})

redis.on("connect", () => {
  console.log("Connected to Redis")
})

redis.on("error", (err) => {
  console.error("Redis error:", err.message)
})
