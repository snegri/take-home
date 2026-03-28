import { Router, Request, Response, NextFunction } from "express"
import { config } from "../config"
import { getAllUsers, getUserById, getLimits, setLimits, deleteLimits, getUsageByUser } from "../db"
import { syncLimitsToRedis } from "../services/rateLimiter"
import { getQueueStats } from "../services/queue"

const router = Router()

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminKey = req.headers["x-admin-key"] as string
  if (adminKey !== config.adminKey) {
    res.status(403).json({
      error: {
        message: "Forbidden: invalid admin key",
        type: "authorization_error",
      },
    })
    return
  }
  next()
}

router.get("/admin/users", adminAuth, (_req: Request, res: Response) => {
  const users = getAllUsers()
  const usersWithUsage = users.map((user) => {
    const usage = getUsageByUser(user.id)
    const limits = getLimits(user.id)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      is_admin: user.is_admin,
      created_at: user.created_at,
      usage,
      limits: limits || null,
    }
  })

  res.json({ users: usersWithUsage })
})

router.get(
  "/admin/users/:userId/usage",
  adminAuth,
  (req: Request<{ userId: string }>, res: Response) => {
    const user = getUserById(req.params.userId)
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } })
      return
    }

    const usage = getUsageByUser(user.id)
    const limits = getLimits(user.id)

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      usage,
      limits: limits || null,
    })
  },
)

router.put(
  "/admin/users/:userId/limits",
  adminAuth,
  async (req: Request<{ userId: string }>, res: Response) => {
    const user = getUserById(req.params.userId)
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } })
      return
    }

    const { requestsPerMinute, tokensPerDay, totalTokenLimit } = req.body

    setLimits(user.id, {
      requestsPerMinute: requestsPerMinute ?? null,
      tokensPerDay: tokensPerDay ?? null,
      totalTokenLimit: totalTokenLimit ?? null,
    })

    // Sync to Redis so rate limiter picks up new values
    await syncLimitsToRedis(user.id, totalTokenLimit ?? null, tokensPerDay ?? null)

    const limits = getLimits(user.id)
    res.json({ limits })
  },
)

router.delete(
  "/admin/users/:userId/limits",
  adminAuth,
  async (req: Request<{ userId: string }>, res: Response) => {
    const user = getUserById(req.params.userId)
    if (!user) {
      res.status(404).json({ error: { message: "User not found" } })
      return
    }

    deleteLimits(user.id)
    await syncLimitsToRedis(user.id, null, null)

    res.json({ message: "Limits removed" })
  },
)

// Queue stats
router.get("/admin/queue", adminAuth, async (_req: Request, res: Response) => {
  const stats = await getQueueStats()
  res.json(stats)
})

export default router
