import { Router, Request, Response } from "express"
import { ChatCompletionRequest, ChatCompletionRequestSchema, TokenUsage } from "../types"
import { handleCompletion, handleStreamingCompletion } from "../services/proxy"
import { trackUsage, settleReservation } from "../services/tokenTracking"
import { reserveTokens, rewardRateLimit } from "../services/rateLimiter"
import { enqueueRequest, QueueFullError } from "../services/queue"

const router = Router()

type CompletionHandler = (
  req: Request,
  res: Response,
  body: ChatCompletionRequest,
) => Promise<TokenUsage | null>

function proxyToOllama(
  req: Request,
  res: Response,
  body: ChatCompletionRequest,
): () => Promise<TokenUsage | null> {
  const handler = (
    body.stream ? handleStreamingCompletion : handleCompletion
  ) satisfies CompletionHandler

  return () => handler(req, res, body)
}

router.post("/v1/chat/completions", async (req: Request, res: Response) => {
  // zod parse body here
  const parsed = ChatCompletionRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: {
        message: "Invalid request body",
      },
    })
    return
  }

  const body = parsed.data
  const user = req.user!

  if (!body.max_tokens) {
    body.max_tokens = 4096
  }

  const { allowed } = await reserveTokens(user.id, body.max_tokens)
  if (!allowed) {
    res.status(429).json({
      error: {
        message: "Token limit exceeded",
      },
    })
    return
  }

  let usage
  try {
    usage = await enqueueRequest(user.id, proxyToOllama(req, res, body))

    if (usage) {
      await trackUsage(user.id, body.model, usage)
    } else {
      await rewardRateLimit(user.id)
    }
  } catch (err) {
    await rewardRateLimit(user.id)
    if (err instanceof QueueFullError) {
      req.log?.warn("Queue full, returning 503", { userId: user.id, model: body.model })
      if (!res.headersSent) {
        res.status(503).json({
          error: {
            message: err.message,
            type: "capacity_error",
          },
        })
      }
    } else if (!res.headersSent) {
      req.log?.error("Proxy error", { error: err })
      res.status(502).json({
        error: {
          message: "Failed to proxy request to Ollama",
          type: "proxy_error",
        },
      })
    }
  } finally {
    await settleReservation(user.id, body.max_tokens!, usage?.total_tokens ?? 0)
  }
})

export default router
