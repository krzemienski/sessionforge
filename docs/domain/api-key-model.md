# API Key Model Domain

> **Category:** Domain Model
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

The API key model defines how external services and integrations authenticate to the SessionForge API. Each workspace can generate multiple API keys for different applications, with granular scope and revocation capabilities.

## Key Structure

### Hashed Storage

API keys are stored hashed in the database, never in plain text:

```
User Input:     "sfc_workspace-abc123_sk_live_xyz789"
                       └─ workspace ID ─┘
Stored Hash:    SHA256("sfc_workspace-abc123_sk_live_xyz789")
```

**Security:** Even database admins cannot see the original key value

### Key Format

```
sfc_{workspace}_{environment}_{random}

sfc_                    — SessionForge prefix
workspace-abc123        — Workspace ID (alphanumeric)
sk_live                 — Environment (sk_live, sk_test, pk_live)
xyz789...               — Random suffix (32+ chars)
```

**Example:** `sfc_workspace-prod-001_sk_live_4f7a2b9e8c3d1f6a5e7b9c2d4f6a8b0e`

## Key Types

### Secret Keys (sk_)

**Purpose:** Server-to-server authentication (private)

**Permissions:**
- Read/write content
- Trigger agent runs
- Publish content
- Access workspace data

**Visibility:** Only shown once at creation (never again)

**Environment:**
- `sk_live` — Production key
- `sk_test` — Testing/development key

**Use Case:** Backend integrations, automation, CI/CD

### Publishable Keys (pk_)

**Purpose:** Client-side authentication (public safe)

**Permissions:**
- Read-only content access
- Read analytics
- Cannot trigger agents or modify data

**Visibility:** Safe to expose in frontend code

**Environment:**
- `pk_live` — Production key
- `pk_test` — Testing key

**Use Case:** Browser-based applications, public APIs

## Database Model

```typescript
{
  id: string;
  workspaceId: string;
  name: string;                    // User-assigned name
  type: "secret" | "publishable";
  environment: "live" | "test";
  hashedKey: string;               // SHA256 hash
  prefix: string;                  // "sfc_workspace-xxx"
  permissions: string[];           // Scopes (future)
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date | null;          // Optional expiration
}
```

## Authentication Flow

### Request with Secret Key

```bash
curl -H "Authorization: Bearer sfc_workspace-abc123_sk_live_xyz789" \
  https://api.sessionforge.com/api/v1/content
```

### Server Validation

```typescript
// 1. Extract key from header
const bearerToken = req.headers.get("Authorization")?.split(" ")[1];

// 2. Hash the key
const hashedKey = SHA256(bearerToken);

// 3. Look up in database
const apiKey = await db.query.apiKeys.findFirst({
  where: eq(apiKeys.hashedKey, hashedKey),
});

// 4. Verify not revoked or expired
if (!apiKey || apiKey.revokedAt || (apiKey.expiresAt < now)) {
  throw UNAUTHORIZED;
}

// 5. Check workspace and permissions
const workspace = await getAuthorizedWorkspace(apiKey.workspaceId);
return workspace;
```

## Key Management

### Creating a Key

1. User navigates to Settings → API Keys
2. Clicks "Create New Key"
3. Selects: name, type (secret/publishable), environment (live/test)
4. Optional: set expiration date
5. Key generated and displayed once
6. User must copy and store securely
7. System shows hashed version only after creation

### Revoking a Key

1. User finds key in Settings
2. Clicks "Revoke"
3. Confirms revocation (cannot be undone)
4. Key immediately unusable for new requests
5. In-flight requests may still complete (race condition)

### Rotating a Key

1. Create new key (same name + "_v2")
2. Update application to use new key
3. Monitor old key for usage
4. After 24-48 hours, revoke old key

## Permissions and Scopes

Currently, keys have binary permissions:
- Secret keys: Full access
- Publishable keys: Read-only

Future enhancement: Fine-grained scopes (e.g., "read:content", "write:content", "read:analytics")

## Rate Limiting

API keys can be rate-limited per workspace:

```
Free tier:      100 requests/hour
Solo tier:      500 requests/hour
Pro tier:       2000 requests/hour
Team tier:      10000 requests/hour
```

**Tracking:** Per-workspace per-minute bucket (not per-key)

## Audit Trail

Every API key action logged:

```json
{
  "event": "api_key_created",
  "workspace_id": "workspace-abc123",
  "key_prefix": "sfc_workspace-abc123_sk_live",
  "created_by": "user@example.com",
  "timestamp": "2026-04-18T10:30:00Z"
}
```

Logged events:
- `api_key_created`
- `api_key_used` (sampled, not all requests)
- `api_key_revoked`
- `api_key_accessed` (Settings page view)

## Security Best Practices

### For Users

1. **Never commit keys to version control** — Use `.env` or secrets manager
2. **Use separate keys per environment** — sk_live for production, sk_test for dev
3. **Rotate keys regularly** — Every 90 days recommended
4. **Revoke unused keys** — Clean up old keys
5. **Monitor key usage** — Check "Last Used" timestamp regularly

### For Developers

1. **Never log keys** — Even partial key exposure is a risk
2. **Hash before storing** — Never store plaintext
3. **Rotate on compromise** — Immediate revocation + new key generation
4. **Use HTTPS only** — Never transmit keys over unencrypted HTTP
5. **Implement timeout** — Keys should be short-lived when possible

## Constraints

1. **Keys are workspace-scoped** — Cannot access multiple workspaces with one key
2. **Keys are read-only after creation** — Cannot modify permissions after creation
3. **Cannot list plaintext keys** — Only hashed versions shown in UI
4. **No key delegation** — Cannot use key to issue new keys
5. **One hash per key** — Deterministic hashing prevents collisions

## Rate Limit Handling

When rate limit exceeded:

```json
HTTP 429 Too Many Requests

{
  "error": "rate_limit_exceeded",
  "message": "Rate limit of 100 requests/hour exceeded",
  "reset_at": "2026-04-18T11:30:00Z",
  "retry_after": 3600
}
```

**Retry Strategy:** Implement exponential backoff (1s, 2s, 4s, 8s, 16s)

## Testing

### Test Keys

```bash
sfc_workspace-test_sk_test_00000000000000000000000000000000
sfc_workspace-test_pk_test_00000000000000000000000000000000
```

Test keys always authenticate successfully in development.

## Cost Considerations

API keys are free to create. Rate limits depend on workspace plan tier.

## Related Documentation

- [Interfaces: Better Auth Integration](../interfaces/better-auth-integration.md) — user authentication
- [Patterns: Workspace Authorization](../patterns/workspace-auth.md) — authorization enforcement
- [Patterns: API Route Wrapper](../patterns/api-route-wrapper.md) — how keys are validated

## External Resources

- [REST API Documentation](../api-reference.md) — how to use API keys
- [Security Best Practices](../security.md) — general security guidelines

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial domain model | capture-docs |
