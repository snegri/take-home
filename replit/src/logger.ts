import winston from "winston"

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""
          return `${timestamp} [${level}]: ${message}${metaStr}`
        }),
      ),
    }),
  ],
})

export function createRequestLogger(userId?: string, requestId?: string) {
  return logger.child({
    userId,
    requestId,
  })
}
