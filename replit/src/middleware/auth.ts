import { Request, Response, NextFunction } from "express"
import { randomUUID } from "crypto"
import { getUserByApiKey } from "../db"
import { createRequestLogger, logger } from "../logger"

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  const requestId = randomUUID()

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Missing or invalid auth header", { requestId, path: req.path })
    res.status(401).json({
      error: {
        message: "Missing or invalid Authorization header. Expected: Bearer <api_key>",
        type: "authentication_error",
        code: "invalid_api_key",
      },
    })
    return
  }

  const apiKey = authHeader.slice(7) // Remove "Bearer "
  const user = getUserByApiKey(apiKey)

  if (!user) {
    logger.warn("Invalid API key", { requestId, path: req.path })
    res.status(401).json({
      error: {
        message: "Invalid API key",
        type: "authentication_error",
        code: "invalid_api_key",
      },
    })
    return
  }

  req.user = user
  req.log = createRequestLogger(user.id, requestId)
  req.log.info("Authenticated request", { path: req.path, method: req.method })
  next()
}
