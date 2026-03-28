import { Request, Response, NextFunction } from "express"
import { checkRequestRateLimit } from "../services/rateLimiter"

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: {
        message: "Unauthorized",
      },
    })
    return
  }

  const rateLimitResult = await checkRequestRateLimit(req.user.id)

  if (!rateLimitResult.allowed) {
    const retryAfterSecs = Math.ceil(rateLimitResult.retryAfterMs / 1000)
    res.setHeader("Retry-After", retryAfterSecs)
    res.status(429).json({
      error: {
        message: "Rate limit exceeded",
      },
    })
    return
  }

  next()
}
