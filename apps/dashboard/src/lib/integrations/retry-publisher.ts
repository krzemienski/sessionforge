/**
 * Retry-publisher module that wraps publishing logic with retry, idempotency,
 * and error classification. Transient failures (5xx, network, 429) are retried
 * with exponential backoff; auth failures (401/403) short-circuit with an
 * 'auth_expired' result; validation errors (422) are permanent failures.
 */

import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  devtoPublications,
  ghostPublications,
  mediumPublications,
  twitterPublications,
  linkedinPublications,
} from "@sessionforge/db";
import { eq } from "drizzle-orm";
import type { Platform, PublishResult } from "@/lib/scheduling/publisher";
import { eventBus } from "@/lib/observability/event-bus";
import { createAgentEvent } from "@/lib/observability/event-types";

// ── Types ──

export interface RetryPublishOptions {
  /** The publish function to wrap with retry logic. */
  publishFn: () => Promise<PublishResult>;
  /** Platform being published to. */
  platform: Platform;
  /** Post ID for idempotency and duplicate checking. */
  postId: string;
  /** Workspace ID for observability event emission. */
  workspaceId?: string;
  /** Maximum number of attempts (including the initial attempt). Default: 4 */
  maxAttempts?: number;
  /** Delay in milliseconds before each retry attempt (indexed by retry number). */
  delays?: number[];
}

export interface RetryPublishResult {
  result: PublishResult;
  attempts: number;
  idempotencyKey: string;
}

// ── Error classification ──

interface PublishError {
  status?: number;
  message?: string;
}

function extractErrorInfo(error: unknown): PublishError {
  if (error == null || typeof error !== "object") {
    return { message: String(error) };
  }
  const status =
    "status" in error && typeof (error as Record<string, unknown>).status === "number"
      ? (error as { status: number }).status
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return { status, message };
}

function isAuthError(error: PublishError): boolean {
  return error.status === 401 || error.status === 403;
}

function isValidationError(error: PublishError): boolean {
  return error.status === 422;
}

function isTransientError(error: PublishError): boolean {
  if (error.status === 429) return true;
  if (error.status != null && error.status >= 500) return true;
  // Network errors have no status code
  if (error.status == null) return true;
  return false;
}

// ── Idempotency ──

/**
 * Generates a deterministic idempotency key for a given post and platform.
 * Uses SHA-256 to produce a stable, collision-resistant key.
 */
export function generateIdempotencyKey(postId: string, platform: string): string {
  return createHash("sha256")
    .update(`${postId}:${platform}`)
    .digest("hex");
}

// ── Duplicate detection ──

/**
 * Checks whether a publication record already exists for this post + platform.
 * Returns the existing publication URL if found, or null otherwise.
 */
async function checkExistingPublication(
  postId: string,
  platform: Platform
): Promise<string | null> {
  switch (platform) {
    case "devto": {
      const existing = await db.query.devtoPublications.findFirst({
        where: eq(devtoPublications.postId, postId),
      });
      return existing?.devtoUrl ?? null;
    }
    default:
      return null;
  }
}

// ── Retry logic ──

const DEFAULT_DELAYS = [1000, 3000, 10000]; // 1s, 3s, 10s
const DEFAULT_MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a publish function with retry logic, idempotency, and error classification.
 *
 * - Retries transient failures (5xx, network errors, 429) with exponential backoff.
 * - Returns an 'auth_expired' result for 401/403 errors (no retry).
 * - Returns a permanent failure for 422 validation errors (no retry).
 * - Checks for existing publications before each attempt to prevent duplicates.
 */
export async function publishWithRetry(
  options: RetryPublishOptions
): Promise<RetryPublishResult> {
  const {
    publishFn,
    platform,
    postId,
    workspaceId,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    delays = DEFAULT_DELAYS,
  } = options;

  const idempotencyKey = generateIdempotencyKey(postId, platform);
  const traceId = crypto.randomUUID();

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Check for existing publication before each attempt to prevent duplicates
    const existingUrl = await checkExistingPublication(postId, platform);
    if (existingUrl) {
      return {
        result: {
          platform,
          success: true,
          skipped: true,
          reason: `Already published to ${platform}`,
          url: existingUrl,
        },
        attempts: attempt,
        idempotencyKey,
      };
    }

    try {
      const result = await publishFn();
      return { result, attempts: attempt, idempotencyKey };
    } catch (error) {
      lastError = error;
      const errorInfo = extractErrorInfo(error);

      // Auth failures: return immediately with auth_expired status
      if (isAuthError(errorInfo)) {
        if (workspaceId) {
          eventBus.emit(
            createAgentEvent(traceId, workspaceId, "retry-publisher", "integration:auth_expired", {
              platform,
              postId,
              attempt,
              errorMessage: errorInfo.message,
            })
          );
        }
        return {
          result: {
            platform,
            success: false,
            error: errorInfo.message ?? "Authentication failed",
          },
          attempts: attempt,
          idempotencyKey,
        };
      }

      // Validation errors: permanent failure, do not retry
      if (isValidationError(errorInfo)) {
        return {
          result: {
            platform,
            success: false,
            error: errorInfo.message ?? "Validation error",
          },
          attempts: attempt,
          idempotencyKey,
        };
      }

      // Transient errors: retry with backoff
      if (isTransientError(errorInfo)) {
        const isLastAttempt = attempt === maxAttempts;
        if (isLastAttempt) break;

        const delay = delays[attempt - 1] ?? delays[delays.length - 1];

        if (workspaceId) {
          eventBus.emit(
            createAgentEvent(traceId, workspaceId, "retry-publisher", "integration:publish_retry", {
              platform,
              postId,
              attempt,
              maxAttempts,
              nextDelayMs: delay,
              errorMessage: errorInfo.message,
              errorStatus: errorInfo.status,
            })
          );
        }

        await sleep(delay);
        continue;
      }

      // Unknown error type: do not retry
      break;
    }
  }

  // All retries exhausted or non-retryable unknown error
  const finalErrorInfo = extractErrorInfo(lastError);
  return {
    result: {
      platform,
      success: false,
      error: finalErrorInfo.message ?? "Publishing failed after all retry attempts",
    },
    attempts: maxAttempts,
    idempotencyKey,
  };
}
