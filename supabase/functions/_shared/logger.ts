export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  function: string
  requestId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

export function log(level: LogLevel, message: string, meta?: Partial<LogEntry>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    function: meta?.function ?? "unknown",
    requestId: meta?.requestId,
    userId: meta?.userId,
    metadata: meta?.metadata,
  }
  console.log(JSON.stringify(entry))
}

export const logger = {
  debug: (msg: string, meta?: Partial<LogEntry>) => log("debug", msg, meta),
  info: (msg: string, meta?: Partial<LogEntry>) => log("info", msg, meta),
  warn: (msg: string, meta?: Partial<LogEntry>) => log("warn", msg, meta),
  error: (msg: string, meta?: Partial<LogEntry>) => log("error", msg, meta),
}
