# API Route Wrapper Pattern

> **Category:** Technical Pattern
> **Last Updated:** 2026-04-18
> **Status:** Active

## Purpose

Provides universal error handling and response normalization for internal and public API routes via decorator wrappers.

## Context

**When to use this pattern:**
- All internal API routes (use `withApiHandler`)
- All v1 public API routes (use `withV1ApiHandler`)
- Any route needing consistent error behavior

**When NOT to use this pattern:**
- Server components (no route handlers)
- Middleware (pre-handler filtering)

## Implementation

### Overview

Two complementary wrappers handle different API surfaces:
- `withApiHandler` — internal routes, session-based auth, returns `{ error, code, details? }`
- `withV1ApiHandler` — public routes, API key auth, returns `{ data, meta, error }`

### Key Components

**withApiHandler**
- Purpose: Catch/normalize errors for internal routes
- Location: `apps/dashboard/src/lib/api-handler.ts:17-55`
- Catches: AppError → structured JSON, unknown → sanitized 500

**withV1ApiHandler**
- Purpose: Public API envelope with consistency
- Location: `apps/dashboard/src/lib/api-auth.ts:154-188`
- Catches: AppError → `{ data: null, meta: {}, error: {...} }`, unknown → same

**Error Response Format (Internal)**
```typescript
{
  error: string;      // Human message
  code: string;       // Machine code from ERROR_CODES
  details?: unknown;  // Optional validation/context
}
```

**Error Response Format (Public v1)**
```typescript
{
  data: null,
  meta: {},
  error: {
    message: string;
    code: string;
    details?: unknown;
  }
}
```

**Success Response Format (Public v1)**
```typescript
{
  data: T,
  meta: { pagination?, timestamps? },
  error: null
}
```

## Usage Examples

### Example 1: Internal Route with withApiHandler

**Situation:** POST /api/posts creates a new post

**Implementation:**
```typescript
// apps/dashboard/src/app/api/posts/route.ts

const handler = async (req: Request): Promise<Response> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);
  }
  
  const body = await req.json();
  const data = createPostSchema.parse(body);
  
  const post = await db.insert(posts).values({
    ...data,
    userId: session.user.id,
  }).returning();
  
  return NextResponse.json(post);
};

export const POST = withApiHandler(handler);
```

**Result:** 
- Success (201): Returns post object
- Validation error (400): Returns `{ error: "Validation failed", code: "VALIDATION_ERROR" }`
- Server error (500): Returns `{ error: "Internal server error", code: "INTERNAL_ERROR" }`

### Example 2: Public v1 Route with withV1ApiHandler

**Situation:** GET /api/v1/content retrieves user's content via API key

**Implementation:**
```typescript
// apps/dashboard/src/app/api/v1/content/route.ts

const handler = async (req: Request): Promise<NextResponse> => {
  const auth = await requireApiKey(req); // throws if no valid key
  
  const content = await db.query.posts.findMany({
    where: eq(posts.workspaceId, auth.workspace.id),
  });
  
  return apiResponse(content, { count: content.length });
};

export const GET = withV1ApiHandler(handler);
```

**Result:**
- Success (200): Returns `{ data: [...], meta: { count: 5 }, error: null }`
- Unauthorized (401): Returns `{ data: null, meta: {}, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }`

## Edge Cases and Gotchas

### Edge Case 1: Unknown Error Handling

**Problem:** Non-AppError thrown in handler should not expose internals

**Solution:** Both wrappers catch unknown errors, log full details internally, return sanitized message

### Edge Case 2: Async Error in try/catch

**Problem:** Errors thrown in async code might not propagate to wrapper

**Solution:** Use `await` for all async operations; wrapper only catches sync/awaited errors

### Edge Case 3: Response Already Sent

**Problem:** If handler sends response before throwing, error response can't be sent

**Solution:** Never return AND throw in same handler; throw all errors at end

## Best Practices

1. **Use for ALL routes** — ensures consistent behavior across codebase
2. **Throw AppError, never return error response** — let wrapper handle response format
3. **Pass required details for validation errors** — helps debugging
4. **Use requireApiKey() in v1 routes** — enforces authentication
5. **Use apiResponse() helper for v1 success** — ensures consistent envelope

## Anti-Patterns

❌ **Don't:** Manually catch errors and return response
**Why:** Inconsistent error handling across routes
**Instead:** Throw error, let wrapper catch it

❌ **Don't:** Mix authenticated and public routes
**Why:** Exposes data to unauthorized users
**Instead:** Use separate route files, clear auth check

## Testing Strategy

- Verify error responses have correct HTTP status
- Verify error code matches error message
- Verify validation errors include details
- Verify unknown errors return 500 with sanitized message
- Verify wrapper preserves successful responses

## Performance Considerations

- Wrapper adds minimal overhead (try/catch is optimized in V8)
- JSON parsing only on error (success path bypassed)
- Error logging is O(1) — JSON.stringify is fast for small objects

## Related Patterns

- [error-handling](./error-handling.md) — AppError class and ERROR_CODES
- [workspace-auth](./workspace-auth.md) — authorization middleware
- [api-auth](./api-key-model.md) — API key authentication

## Code References

- `apps/dashboard/src/lib/api-handler.ts:17-55` — withApiHandler
- `apps/dashboard/src/lib/api-auth.ts:154-188` — withV1ApiHandler
- `apps/dashboard/src/lib/api-auth.ts:79-112` — apiResponse/apiError helpers

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial documentation | capture-docs |
