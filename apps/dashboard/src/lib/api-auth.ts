import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { apiKeys } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getRedis } from "@/lib/redis";
import type { ZodSchema } from "zod";

const LAST_USED_DEBOUNCE_SECONDS = 60;

async function touchLastUsedDebounced(apiKeyId: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    const key = `api-key:last-used:${apiKeyId}`;
    const recent = await redis.get<string>(key);
    if (recent) return;
    await redis.set(key, "1", { ex: LAST_USED_DEBOUNCE_SECONDS });
  }
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKeyId));
}

export async function authenticateApiKey(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice(7);
  if (!token) return null;

  const keyHash = createHash("sha256").update(token).digest("hex");

  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
    with: { workspace: true },
  });

  if (!apiKey) return null;

  void touchLastUsedDebounced(apiKey.id).catch((err) => {
    console.warn("[api-key] lastUsedAt update failed:", err);
  });

  return { workspace: apiKey.workspace, apiKeyId: apiKey.id };
}

/**
 * API-key auth guard for v1 routes: returns the authenticated context or
 * throws `AppError("Unauthorized", UNAUTHORIZED)` so withV1ApiHandler
 * normalizes the response. Collapses the `authenticateApiKey + null check`
 * prologue every v1 route used to duplicate.
 */
export async function requireApiKey(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);
  return auth;
}

/** Public v1 envelope for successful responses. */
export function apiResponse<T>(
  data: T,
  meta?: object,
  status = 200,
): NextResponse {
  return NextResponse.json(
    { data, meta: meta ?? {}, error: null },
    { status },
  );
}

/**
 * Public v1 envelope for error responses.
 * `message` is shown to the API client; `code` is a stable ERROR_CODES slug.
 */
export function apiError(
  message: string,
  status: number,
  code: string = ERROR_CODES.INTERNAL_ERROR,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      data: null,
      meta: {},
      error: { message, code, ...(details !== undefined ? { details } : {}) },
    },
    { status },
  );
}

/** Parse and validate a JSON request body against a Zod schema. */
export async function parseV1Body<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("Invalid JSON body", ERROR_CODES.BAD_REQUEST);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      "Request validation failed",
      ERROR_CODES.VALIDATION_ERROR,
      undefined,
      parsed.error.flatten() as Record<string, unknown>,
    );
  }
  return parsed.data;
}

type V1HandlerFn<Ctx = undefined> = Ctx extends undefined
  ? (req: Request) => Promise<NextResponse>
  : (req: Request, ctx: Ctx) => Promise<NextResponse>;

/**
 * Wraps a public v1 route handler so every thrown AppError / unknown error is
 * normalized to the `{data, meta, error: {message, code, details?}}` envelope.
 * Callers stop needing per-route try/catch + per-route error branching.
 *
 * Supports both static routes `(req) => ...` and Next 15 dynamic routes
 * `(req, { params }) => ...` — the context arg (if any) is forwarded verbatim.
 */
export function withV1ApiHandler<Ctx = undefined>(
  handler: V1HandlerFn<Ctx>,
): V1HandlerFn<Ctx> {
  const wrapped = async (req: Request, ctx?: Ctx): Promise<NextResponse> => {
    try {
      return await (handler as (req: Request, ctx?: Ctx) => Promise<NextResponse>)(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        const errorObj: Record<string, unknown> = {
          message: err.message,
          code: err.code,
        };
        if (err.details !== undefined) {
          errorObj.details = err.details;
        }
        return NextResponse.json(
          { data: null, meta: {}, error: errorObj },
          { status: err.statusCode },
        );
      }
      console.error(
        JSON.stringify({
          level: "error",
          timestamp: new Date().toISOString(),
          source: "v1-api-handler",
          method: req.method,
          url: req.url,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return apiError("Internal server error", 500, ERROR_CODES.INTERNAL_ERROR);
    }
  };
  return wrapped as V1HandlerFn<Ctx>;
}
