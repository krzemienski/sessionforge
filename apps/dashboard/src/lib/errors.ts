/** Standard error codes for API responses. Maps to HTTP status codes via STATUS_MAP. */
export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

/** Type representing all valid error codes. */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

/**
 * Structured application error with error code and HTTP status.
 * Used across API routes for uniform error handling and response formatting.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  /**
   * @param message - Human-readable error message.
   * @param code - Machine-readable error code from ERROR_CODES.
   * @param statusCode - Optional HTTP status override (defaults to STATUS_MAP[code]).
   * @param details - Optional error details (e.g., validation errors).
   */
  constructor(
    message: string,
    code: ErrorCode,
    statusCode?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode ?? STATUS_MAP[code];
    this.details = details;
  }
}

/** Formatted error response sent to internal API clients. */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Converts an AppError to a structured ErrorResponse for API responses.
 * @param error - AppError instance.
 * @returns Formatted error response with message, code, and optional details.
 */
export function formatErrorResponse(error: AppError): ErrorResponse {
  const response: ErrorResponse = {
    error: error.message,
    code: error.code,
  };
  if (error.details !== undefined) {
    response.details = error.details;
  }
  return response;
}

/**
 * Drop-in replacement for `} catch {}` — preserves the control-flow semantics
 * (error is swallowed, execution continues) while emitting a structured log
 * line so an operator can trace failures post-facto. Review finding M6.
 *
 * Use at sites where a failure is genuinely non-fatal (e.g. best-effort cache
 * invalidation, fire-and-forget webhook). Do NOT use it to hide errors that
 * should surface to callers — those need a proper try/catch with rethrow.
 */
export function logAndIgnore(source: string, err: unknown, extra?: Record<string, unknown>): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      timestamp: new Date().toISOString(),
      source,
      error: err instanceof Error ? err.message : String(err),
      ...(extra ?? {}),
    }),
  );
}
