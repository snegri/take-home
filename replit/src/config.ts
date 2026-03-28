export const config = {
  port: parseInt(process.env.PORT || "8000", 10),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  sqlitePath: process.env.SQLITE_PATH || "./data/proxy.db",
  adminKey: process.env.ADMIN_KEY || "admin-secret-key",
  ollamaConcurrency: parseInt(process.env.OLLAMA_CONCURRENCY || "10", 10),
  maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || "100", 10),
}
