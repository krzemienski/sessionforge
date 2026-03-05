import { createHash } from "crypto";
import { db } from "@/lib/db";
import { apiKeys } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export interface ApiKeyValidationResult {
  valid: boolean;
  workspaceId?: string;
  error?: string;
}

/**
 * Validates an API key from the Authorization header and returns the associated workspace.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer sf_live_...")
 * @returns Validation result with workspaceId if valid, or error message
 *
 * @example
 * const result = await validateApiKey(request.headers.get("Authorization"));
 * if (!result.valid) {
 *   return NextResponse.json({ error: result.error }, { status: 401 });
 * }
 */
export async function validateApiKey(
  authHeader: string | null
): Promise<ApiKeyValidationResult> {
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  // Extract Bearer token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return { valid: false, error: "Invalid Authorization header format" };
  }

  const rawKey = parts[1];

  // Validate key format (should start with sf_live_)
  if (!rawKey.startsWith("sf_live_")) {
    return { valid: false, error: "Invalid API key format" };
  }

  // Hash the provided key
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  // Query database for matching key
  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
    columns: {
      id: true,
      workspaceId: true,
    },
  });

  if (!apiKey) {
    return { valid: false, error: "Invalid API key" };
  }

  // Update lastUsedAt timestamp
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id));

  return {
    valid: true,
    workspaceId: apiKey.workspaceId,
  };
}
