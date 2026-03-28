import { config } from "../config"
import { logger } from "../logger"

let queue: import("p-queue").default | null = null

// Track how many requests each user currently has in-flight + waiting
const userInflight = new Map<string, number>()

async function getQueue() {
  if (!queue) {
    const { default: PQueue } = await import("p-queue")
    queue = new PQueue({ concurrency: config.ollamaConcurrency })
    logger.info("Request queue initialized", {
      concurrency: config.ollamaConcurrency,
      maxQueueSize: config.maxQueueSize,
    })
  }
  return queue
}

export async function enqueueRequest<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const q = await getQueue()

  if (q.pending + q.size >= config.maxQueueSize) {
    throw new QueueFullError()
  }

  // p-queue: higher number = higher priority (scheduled first)
  // Negate in-flight count so users with fewer pending requests get priority
  const currentCount = userInflight.get(userId) ?? 0
  userInflight.set(userId, currentCount + 1)

  try {
    const result = await q.add(fn, { priority: -currentCount })
    return result
  } finally {
    const count = userInflight.get(userId) ?? 1
    if (count <= 1) {
      userInflight.delete(userId)
    } else {
      userInflight.set(userId, count - 1)
    }
  }
}

export async function getQueueStats(): Promise<{
  concurrency: number
  pending: number
  size: number
  maxQueueSize: number
  perUser: Record<string, number>
}> {
  const q = await getQueue()
  return {
    concurrency: config.ollamaConcurrency,
    pending: q.pending,
    size: q.size,
    maxQueueSize: config.maxQueueSize,
    perUser: Object.fromEntries(userInflight),
  }
}

export class QueueFullError extends Error {
  constructor() {
    super("Server is at capacity, please retry later")
    this.name = "QueueFullError"
  }
}
