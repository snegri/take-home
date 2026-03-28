import { redis } from "../redis"
import { recordUsage } from "../db"
import { TokenUsage } from "../types"
import { logger } from "../logger"

export async function trackUsage(userId: string, model: string, usage: TokenUsage): Promise<void> {
  // Redis counters are already handled by the reservation pattern
  // (reserveTokens + settleReservation). We only write the audit ledger here.
  recordUsage(userId, model, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens)

  logger.info("Tracked usage", { userId, model, usage })
}

export async function settleReservation(
  userId: string,
  reservedTokens: number,
  actualTokens: number,
): Promise<void> {
  const diff = reservedTokens - actualTokens
  if (diff <= 0) return

  // Release the unused portion of the reservation
  await redis.decrby(`usage:${userId}:total`, diff)

  const today = new Date().toISOString().slice(0, 10)
  await redis.decrby(`usage:${userId}:daily:${today}`, diff)

  logger.info("Settled reservation", { userId, reservedTokens, actualTokens, released: diff })
}
