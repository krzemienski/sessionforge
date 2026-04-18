# Error Handling Pattern

> **Category:** Technical Pattern
> **Last Updated:** 2026-04-18
> **Status:** Active

## Purpose

Provides a uniform error structure across all API routes using `AppError` class and `ERROR_CODES` enum, enabling consistent error responses and HTTP status mapping.

## Context

**When to use this pattern:**
- All internal API routes (use `withApiHandler`)
- All v1 public API routes (use `withV1ApiHandler`)
- Any operation that needs structured error reporting

**When NOT to use this pattern:**
- Client-side error handling (use try/catch directly)
- Non-API contexts where status codes don't apply

## Implementation

### Overview

The pattern uses a custom `AppError` class that maps machine-readable error codes to HTTP status codes. Every route handler is wrapped with either `withApiHandler` or `withV1ApiHandler` which catches all errors and normalizes them.

### Key Components

**AppError Class**
- Purpose: Custom error with code + status mapping
- Location: `apps/dashboard/src/lib/errors.ts:27-50`
- Maps error code → HTTP status via `STATUS_MAP`

**ERROR_CODES Enum**
- Purpose: Machine-readable error identifiers
- Location: `apps/dashboard/src/lib/errors.ts:2-9`
- Values: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `BAD_REQUEST`, `INTERNAL_ERROR`

**withApiHandler Wrapper**
- Purpose: Catches `AppError` and unknown errors, normalizes responses
- Location: `apps/dashboard/src/lib/api-handler.ts:17-55`
- Returns `{ error, code, details? }` for AppError, `{ error: "Internal server error", code: "INTERNAL_ERROR" }` for unknown

**withV1ApiHandler Wrapper**
- Purpose: Public API v1 envelope: `{ data, meta, error }`
- Location: `apps/dashboard/src/lib/api-auth.ts:154-188`

**formatErrorResponse Utility**
- Purpose: Converts AppError to response object
- Location: `apps/dashboard/src/lib/errors.ts:64-73`

## Usage Examples

### Example 1: Throwing AppError in Route Handler

**Situation:** User requests a post they don't own

**Implementation:**
```typescript
export async function GET(req: Request) {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });
  
  if (!post) {
    throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
  }
  
  return NextResponse.json({ post });
}

// Wrapped with withApiHandler:
export const GET = withApiHandler(originalHandler);
```

**Result:** Returns `{ error: "Post not found", code: "NOT_FOUND" }` with status 404

### Example 2: Validation Error with Details

**Situation:** Request body fails schema validation

**Implementation:**
```typescript
const payload = createPostSchema.safeParse(body);
if (!payload.success) {
  throw new AppError(
    "Validation failed",
    ERROR_CODES.VALIDATION_ERROR,
    undefined,
    payload.error.flatten()
  );
}
```

**Result:** Returns `{ error: "Validation failed", code: "VALIDATION_ERROR", details: {...} }` with status 400

## Edge Cases and Gotchas

### Edge Case 1: Logging Non-AppError Exceptions

**Problem:** Unknown errors are logged but never expose internal details to clients

**Solution:** `withApiHandler` catches all errors, logs them with full context, but returns sanitized 500 response

### Edge Case 2: Custom Status Override

**Problem:** Some codes need non-standard status (e.g., validation → 422 instead of 400)

**Solution:** Pass explicit status to AppError constructor: `new AppError(msg, code, 422)`

## Best Practices

1. **Always throw AppError, never string errors** — enables consistent response formatting and logging
2. **Use ERROR_CODES enum** — single source of truth for error identifiers
3. **Include context in message** — "Post #123 not found" is better than "Not found"
4. **Pass details for validation errors** — helps clients understand what failed
5. **Wrap all routes with appropriate handler** — `withApiHandler` or `withV1ApiHandler`

## Anti-Patterns

❌ **Don't:** Throw strings or generic Error objects
**Why:** Can't map to HTTP status or normalize responses
**Instead:** Throw `new AppError(message, ERROR_CODES.X)`

❌ **Don't:** Expose internal error messages to clients
**Why:** Leaks implementation details and causes security issues
**Instead:** Return sanitized message, log full error internally

## Testing Strategy

- Test routes with `withApiHandler` by catching thrown AppError
- Verify response format: `{ error, code, details? }`
- Verify HTTP status matches ERROR_CODES mapping
- Test unknown error handling returns 500 with sanitized message

## Performance Considerations

- AppError construction is O(1) — no performance impact
- Error logging is async/non-blocking via console (infrastructure logs it)
- `formatErrorResponse` is pure function — no DB access

## Related Patterns

- [api-route-wrapper](./api-route-wrapper.md) — how routes use withApiHandler
- [workspace-auth](./workspace-auth.md) — throws AppError on auth failure

## Code References

- `apps/dashboard/src/lib/errors.ts` — AppError class, ERROR_CODES, formatErrorResponse
- `apps/dashboard/src/lib/api-handler.ts:17-55` — withApiHandler wrapper
- `apps/dashboard/src/lib/api-auth.ts:154-188` — withV1ApiHandler wrapper

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial documentation | capture-docs |
