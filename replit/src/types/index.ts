export * from "./db"
export * from "./api"

import type { User } from "./db"
import type { Logger } from "winston"

declare global {
  namespace Express {
    interface Request {
      user?: User
      log?: Logger
    }
  }
}
