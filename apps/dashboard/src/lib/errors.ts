export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

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

export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

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
