import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { apiKeys } from "@sessionforge/db";
import { eq } from "drizzle-orm";

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

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id));

  return { workspace: apiKey.workspace, apiKeyId: apiKey.id };
}

export function apiResponse<T>(
  data: T,
  meta?: object,
  status = 200
): NextResponse {
  return NextResponse.json({ data, meta: meta ?? {}, error: null }, { status });
}

export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ data: null, meta: {}, error: message }, { status });
}
