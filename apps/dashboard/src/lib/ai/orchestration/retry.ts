/**
 * Retry utility with exponential backoff and rate limit detection.
 * Wraps async functions with configurable retry logic for Anthropic API calls.
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the initial attempt). */
  maxAttempts: number;
  /** Delay in milliseconds before each retry attempt (indexed by attempt number, 0-based). */
  delays: number[];
  /** Delay in milliseconds to use when a rate limit error (429) is detected. */
  rateLimitDelay: number;
  /** Called before each retry with attempt number (1-based), the error, and the delay to be used. */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
}

/**
 * Detects whether an error is an HTTP 429 rate limit response from the Anthropic API.
 */
export function isRateLimitError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const status = (error as Record<string, unknown>).status;
  return status === 429;
}

/**
 * Executes fn() up to options.maxAttempts times with exponential backoff.
 * Returns the result and total attempt count on success, or throws the final error.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<RetryResult<T>> {
  const { maxAttempts, delays, rateLimitDelay, onRetry } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt) break;

      const delay = isRateLimitError(error)
        ? rateLimitDelay
        : (delays[attempt - 1] ?? delays[delays.length - 1]);

      onRetry?.(attempt, error, delay);

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
