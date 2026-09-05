// ==========================================================================
// AppError — structured application errors with code, message, and
// optional cause chain for debugging.
// ==========================================================================

export type ErrorCode =
  // Auth
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_UNAUTHORIZED"
  // Storage
  | "STORAGE_NOT_FOUND"
  | "STORAGE_CONFLICT"
  | "STORAGE_NETWORK"
  // Engine
  | "ENGINE_INVALID_CONTEXT"
  | "ENGINE_EVALUATION_FAILED"
  // Tracking
  | "TRACKER_SESSION_DUPLICATE"
  | "TRACKER_INVALID_PLATFORM"
  // Validation
  | "VALIDATION_FAILED"
  // Unknown
  | "UNKNOWN"

/**
 * Structured error with machine-readable code.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly cause?: Error
  readonly statusCode?: number
  readonly details?: Record<string, unknown>

  constructor(opts: {
    message: string
    code: ErrorCode
    cause?: Error
    statusCode?: number
    details?: Record<string, unknown>
  }) {
    super(opts.message)
    this.name = "AppError"
    this.code = opts.code
    this.cause = opts.cause
    this.statusCode = opts.statusCode
    this.details = opts.details
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      stack: this.stack,
    }
  }
}

/**
 * Result type for operations that may fail.
 * Forces explicit error handling instead of try/catch everywhere.
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

/**
 * Wrap an async operation that may throw, returning a Result.
 */
export async function tryResult<T>(
  fn: () => Promise<T>
): Promise<Result<T, AppError>> {
  try {
    const value = await fn()
    return ok(value)
  } catch (e) {
    if (e instanceof AppError) return err(e)
    return err(
      new AppError({
        message: e instanceof Error ? e.message : "Unknown error",
        code: "UNKNOWN",
        cause: e instanceof Error ? e : undefined,
      })
    )
  }
}

/**
 * Global error reporter. In production, send to Sentry/etc.
 * For MVP, it logs to console.
 */
export function reportError(error: unknown): void {
  console.error("[GlobalError]", error)

  if (error instanceof AppError) {
    console.error(`  Code: ${error.code}`)
    if (error.details) console.error("  Details:", error.details)
    if (error.cause) console.error("  Cause:", error.cause)
  } else if (error instanceof Error) {
    console.error(`  Stack: ${error.stack}`)
  }
}
