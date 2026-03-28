import express from "express"
import { config } from "./config"
import { seedTestUsers } from "./db"
import { authMiddleware } from "./middleware/auth"
import { rateLimitMiddleware } from "./middleware/rateLimit"
import chatRoutes from "./routes/chat"
import usageRoutes from "./routes/usage"
import adminRoutes from "./routes/admin"

const app = express()

app.use(express.json({ limit: "10mb" }))

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.use(adminRoutes)

app.use(authMiddleware, rateLimitMiddleware, chatRoutes)
app.use(authMiddleware, rateLimitMiddleware, usageRoutes)

seedTestUsers()

app.listen(config.port, () => {
  console.log(`Proxy server running on port ${config.port}`)
  console.log(`Ollama URL: ${config.ollamaUrl}`)
  console.log(`Queue: concurrency=${config.ollamaConcurrency}, maxSize=${config.maxQueueSize}`)
})

export default app
