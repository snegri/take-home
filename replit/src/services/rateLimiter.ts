import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible"
import { redis } from "../redis"
import { getLimits } from "../db"

const rateLimiters = new Map<number, RateLimiterRedis>()

function getRateLimiter(requestsPerMinute: number): RateLimiterRedis {
  let limiter = rateLimiters.get(requestsPerMinute)
  if (!limiter) {
    limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl",
      points: requestsPerMinute,
      duration: 60,
    })
    rateLimiters.set(requestsPerMinute, limiter)
  }
  return limiter
}

export async function checkRequestRateLimit(
  userId: string,
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const limits = getLimits(userId)
  if (!limits?.requests_per_minute) return { allowed: true }

  const limiter = getRateLimiter(limits.requests_per_minute)
  try {
    await limiter.consume(userId)
    return { allowed: true }
  } catch (err) {
    const retryAfterMs = err instanceof RateLimiterRes ? (err.msBeforeNext ?? 0) : 0
    return { allowed: false, retryAfterMs }
  }
}

export async function rewardRateLimit(userId: string): Promise<void> {
  const limits = getLimits(userId)
  if (!limits?.requests_per_minute) return

  const limiter = getRateLimiter(limits.requests_per_minute)
  try {
    await limiter.reward(userId)
  } catch {
    // best effort - if reward fails, user just lost one point
  }
}

const RESERVE_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(redis.call('GET', KEYS[2]) or '-1')
local reserve = tonumber(ARGV[1])
if limit >= 0 and current + reserve > limit then
    return -1
end
redis.call('INCRBY', KEYS[1], reserve)
return current + reserve
`

export async function reserveTokens(
  userId: string,
  maxTokens: number,
): Promise<{ allowed: boolean; currentUsage: number }> {
  const limits = getLimits(userId)

  // Check total token limit
  if (limits?.total_token_limit) {
    const result = (await redis.eval(
      RESERVE_SCRIPT,
      2,
      `usage:${userId}:total`,
      `limit:${userId}:total`,
      maxTokens,
    )) as number

    if (result === -1) {
      return { allowed: false, currentUsage: -1 }
    }
  }

  // Check daily token limit
  if (limits?.tokens_per_day) {
    const today = new Date().toISOString().slice(0, 10)
    const dailyKey = `usage:${userId}:daily:${today}`

    const result = (await redis.eval(
      RESERVE_SCRIPT,
      2,
      dailyKey,
      `limit:${userId}:daily`,
      maxTokens,
    )) as number

    if (result === -1) {
      // Roll back the total reservation we just made
      if (limits?.total_token_limit) {
        await redis.decrby(`usage:${userId}:total`, maxTokens)
      }
      return { allowed: false, currentUsage: -1 }
    }

    // Set TTL on daily key so it auto-expires (48h to be safe)
    await redis.expire(dailyKey, 172800)
  }

  const currentUsage = parseInt((await redis.get(`usage:${userId}:total`)) || "0", 10)
  return { allowed: true, currentUsage }
}

/**
 * Sync limit values from SQLite to Redis.
 * Called when an admin updates limits so the Lua script
 * can read them without hitting SQLite.
 */
export async function syncLimitsToRedis(
  userId: string,
  totalTokenLimit: number | null,
  tokensPerDay: number | null,
): Promise<void> {
  if (totalTokenLimit !== null) {
    await redis.set(`limit:${userId}:total`, totalTokenLimit)
  } else {
    await redis.del(`limit:${userId}:total`)
  }

  if (tokensPerDay !== null) {
    await redis.set(`limit:${userId}:daily`, tokensPerDay)
  } else {
    await redis.del(`limit:${userId}:daily`)
  }
}
