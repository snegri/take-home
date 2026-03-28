import Database, { Database as DatabaseType } from "better-sqlite3"
import { createHash } from "crypto"
import { v4 as uuidv4 } from "uuid"
import { config } from "./config"
import { User, BillingLimits, UsageLedgerEntry } from "./types"
import * as fs from "fs"
import * as path from "path"

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

const dbDir = path.dirname(config.sqlitePath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const db: DatabaseType = new Database(config.sqlitePath)

// Enable WAL mode for concurrent read performance
db.pragma("journal_mode = WAL")
db.pragma("foreign_keys = ON")

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS billing_limits (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
    requests_per_minute INTEGER,
    tokens_per_day INTEGER,
    total_token_limit INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS usage_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
  CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_created ON usage_ledger(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_model ON usage_ledger(user_id, model);
`)

const stmts = {
  getUserByApiKey: db.prepare("SELECT * FROM users WHERE api_key = ?"),
  getUserById: db.prepare("SELECT * FROM users WHERE id = ?"),
  getAllUsers: db.prepare("SELECT * FROM users"),
  insertUser: db.prepare(
    "INSERT INTO users (id, name, email, api_key, is_admin) VALUES (?, ?, ?, ?, ?)",
  ),

  getLimits: db.prepare("SELECT * FROM billing_limits WHERE user_id = ?"),
  upsertLimits: db.prepare(`
    INSERT INTO billing_limits (id, user_id, requests_per_minute, tokens_per_day, total_token_limit, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      requests_per_minute = excluded.requests_per_minute,
      tokens_per_day = excluded.tokens_per_day,
      total_token_limit = excluded.total_token_limit,
      updated_at = datetime('now')
  `),
  deleteLimits: db.prepare("DELETE FROM billing_limits WHERE user_id = ?"),

  insertUsageLedger: db.prepare(
    "INSERT INTO usage_ledger (id, user_id, model, prompt_tokens, completion_tokens, total_tokens) VALUES (?, ?, ?, ?, ?, ?)",
  ),
  getUsageByUser: db.prepare(`
    SELECT model,
           SUM(prompt_tokens) as prompt_tokens,
           SUM(completion_tokens) as completion_tokens,
           SUM(total_tokens) as total_tokens,
           COUNT(*) as request_count
    FROM usage_ledger
    WHERE user_id = ?
    GROUP BY model
  `),
  getUsageByUserAndDateRange: db.prepare(`
    SELECT model,
           SUM(prompt_tokens) as prompt_tokens,
           SUM(completion_tokens) as completion_tokens,
           SUM(total_tokens) as total_tokens,
           COUNT(*) as request_count
    FROM usage_ledger
    WHERE user_id = ? AND created_at >= ? AND created_at <= ?
    GROUP BY model
  `),
}

export function getUserByApiKey(apiKey: string): User | undefined {
  return stmts.getUserByApiKey.get(hashApiKey(apiKey)) as User | undefined
}

export function getUserById(id: string): User | undefined {
  return stmts.getUserById.get(id) as User | undefined
}

export function getAllUsers(): User[] {
  return stmts.getAllUsers.all() as User[]
}

export function createUser(
  name: string,
  email: string,
  apiKey: string,
  isAdmin: boolean = false,
): User {
  const id = uuidv4()
  stmts.insertUser.run(id, name, email, hashApiKey(apiKey), isAdmin ? 1 : 0)
  return getUserById(id)!
}

export function getLimits(userId: string): BillingLimits | undefined {
  return stmts.getLimits.get(userId) as BillingLimits | undefined
}

export function setLimits(
  userId: string,
  limits: {
    requestsPerMinute?: number | null
    tokensPerDay?: number | null
    totalTokenLimit?: number | null
  },
): void {
  stmts.upsertLimits.run(
    uuidv4(),
    userId,
    limits.requestsPerMinute ?? null,
    limits.tokensPerDay ?? null,
    limits.totalTokenLimit ?? null,
  )
}

export function deleteLimits(userId: string): void {
  stmts.deleteLimits.run(userId)
}

export function recordUsage(
  userId: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
): void {
  stmts.insertUsageLedger.run(uuidv4(), userId, model, promptTokens, completionTokens, totalTokens)
}

export function getUsageByUser(userId: string) {
  return stmts.getUsageByUser.all(userId)
}

export function getUsageByUserAndDateRange(userId: string, startDate: string, endDate: string) {
  return stmts.getUsageByUserAndDateRange.all(userId, startDate, endDate)
}

export function seedTestUsers(): void {
  const existingUsers = getAllUsers()
  if (existingUsers.length > 0) return

  console.log("Seeding test users...")
  createUser("Alice", "alice@example.com", "sk-alice-secret-key-123", false)
  createUser("Bob", "bob@example.com", "sk-bob-secret-key-456", false)
  createUser("Admin", "admin@example.com", "sk-admin-key-789", true)
  console.log("Seeded 3 test users")
}

export { db }
