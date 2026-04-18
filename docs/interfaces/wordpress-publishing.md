# WordPress Publishing Integration

> **Category:** External Interface
> **Service:** WordPress REST API
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

**Service:** WordPress REST API (v2)
**Provider:** WordPress Foundation / Self-hosted WordPress instances
**Purpose:** Publish SessionForge blog posts to self-hosted WordPress and WordPress.com sites
**Documentation:** [WordPress REST API Handbook](https://developer.wordpress.org/rest-api/)

## Authentication

### Method

**Application Passwords** — HTTP Basic Authentication over HTTPS only

An Application Password is a 24-character alphanumeric token generated per WordPress user account, providing granular access control without exposing the user's main password.

**Location:** `apps/dashboard/src/lib/wordpress/client.ts:87-92`

```typescript
private getAuthHeader(): string {
  const credentials = Buffer.from(
    `${this.username}:${this.appPassword}`
  ).toString("base64");
  return `Basic ${credentials}`;
}
```

### Credentials Management

**Location:** Database table `wordpress_connections` — `packages/db/src/schema/tables.ts`

**Credentials Storage:**
```typescript
export const wordpressConnections = pgTable("wordpress_connections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  siteUrl: text("site_url").notNull(),
  username: text("username").notNull(),
  encryptedAppPassword: text("encrypted_app_password").notNull(),
  isActive: boolean("is_active").default(true),
  healthStatus: integrationHealthStatusEnum("health_status").default("healthy"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
});
```

**Encryption:** Application passwords are encrypted using AES-256-CBC at rest. Encryption key derived from `BETTER_AUTH_SECRET` environment variable.

**Location:** `apps/dashboard/src/lib/wordpress/crypto.ts`

- **Encrypt:** `encryptAppPassword(plaintext: string)` — returns `'iv_hex:ciphertext_hex'` format
- **Decrypt:** `decryptAppPassword(encrypted: string)` — reverses process, throws on invalid format

**Rotation Policy:** 
- Manual rotation: User generates new Application Password in WordPress admin, updates via PUT `/api/workspace/[slug]/wordpress`
- No automatic rotation currently implemented

### Authentication Example

**Setup:**
```typescript
const client = new WordPressClient(
  "https://mysite.com",
  "editor_username",
  "xxxx xxxx xxxx xxxx xxxx xxxx"  // 24-char Application Password
);

const siteInfo = await client.testConnection();
// Returns: { id: 1, name: "Editor", url: "...", description: "..." }
```

**Location:** `apps/dashboard/src/lib/wordpress/client.ts:45-54`

## API Endpoints Used

### Endpoint 1: Test Connection — GET `/users/me`

**URL:** `GET {site_url}/wp-json/wp/v2/users/me`

**Purpose:** Verify stored credentials are valid and retrieve authenticated user info

**Response:**
```json
{
  "id": 1,
  "name": "Editor Username",
  "url": "https://mysite.com",
  "description": "User bio"
}
```

**Location:** `apps/dashboard/src/lib/wordpress/client.ts:136-152`

**Error Handling:**
- `401`: Invalid credentials — user must re-authenticate in settings
- `403`: Application Password revoked — user must generate new one
- Network error: Wrapped in descriptive message, surfaced as 502 to client

### Endpoint 2: Fetch Categories — GET `/categories`

**URL:** `GET {site_url}/wp-json/wp/v2/categories?per_page=100&orderby=name&order=asc`

**Purpose:** Retrieve all WordPress post categories for category selection UI

**Response:**
```json
[
  {
    "id": 1,
    "name": "Technology",
    "slug": "technology",
    "count": 12
  }
]
```

**Location:** `apps/dashboard/src/lib/wordpress/client.ts:158-176`

**Pagination:** Fetches up to 100 categories per page (WordPress REST API default max)

### Endpoint 3: Fetch Tags — GET `/tags`

**URL:** `GET {site_url}/wp-json/wp/v2/tags?per_page=100&orderby=name&order=asc`

**Purpose:** Retrieve all WordPress post tags for tag selection UI

**Response:**
```json
[
  {
    "id": 5,
    "name": "AI",
    "slug": "ai",
    "count": 8
  }
]
```

**Location:** `apps/dashboard/src/lib/wordpress/client.ts:182-200`

### Endpoint 4: Create Post — POST `/posts`

**URL:** `POST {site_url}/wp-json/wp/v2/posts`

**Purpose:** Publish SessionForge blog post to WordPress as a new post

**Request:**
```json
{
  "title": "Post Title",
  "content": "<h2>HTML content</h2>",
  "excerpt": "Optional excerpt",
  "status": "draft|publish",
  "categories": [1, 3],
  "tags": [5, 12],
  "featured_media": 42
}
```

**Response:**
```json
{
  "id": 256,
  "link": "https://mysite.com/2026/04/post-title/",
  "status": "draft",
  "title": { "rendered": "Post Title" },
  "date": "2026-04-18T14:30:00"
}
```

**Location:** `apps/dashboard/src/lib/wordpress/client.ts:206-249`

**Post Status:**
- `"draft"` — Saves as draft (default when `status` omitted)
- `"publish"` — Immediately publishes (requires `PUBLISH_POSTS` capability)
- `"pending"` — Requires editorial review
- `"private"` — Visible only to logged-in users

**Error Handling:**
- `400`: Invalid post data (missing title, bad category ID, etc.) — client should validate
- `401`/`403`: Authorization failure — application password revoked or insufficient permissions
- `500`: WordPress internal error — wrapped in descriptive message, retryable

## Data Mapping

### SessionForge → WordPress

| SessionForge Field | WordPress Field | Transformation | Location |
|--------------------|-----------------|----------------|----------|
| `post.title` | `title` | Direct string | `apps/dashboard/src/lib/wordpress/client.ts:207` |
| `post.markdown` | `content` | Convert MD→HTML via `markdownToHtml()` | `apps/dashboard/src/app/api/content/[id]/wordpress/publish/route.ts:119` |
| `body.excerpt` | `excerpt` | Optional string | `apps/dashboard/src/lib/wordpress/client.ts:213-214` |
| `body.categories[]` | `categories[]` | Array of category IDs | `apps/dashboard/src/lib/wordpress/client.ts:217-218` |
| `body.tags[]` | `tags[]` | Array of tag IDs | `apps/dashboard/src/lib/wordpress/client.ts:221-222` |
| `body.featuredMediaId` | `featured_media` | WordPress media ID (number) | `apps/dashboard/src/lib/wordpress/client.ts:225-226` |
| `body.status` | `status` | `"draft"` or `"publish"` | `apps/dashboard/src/app/api/content/[id]/wordpress/publish/route.ts:107-116` |

### WordPress → SessionForge

| WordPress Field | SessionForge Field | Transformation | Location |
|-----------------|-------------------|----------------|----------|
| `id` | `wordpressPostId` | Stored as string | `apps/dashboard/src/app/api/content/[id]/wordpress/publish/route.ts:147` |
| `link` | `wordpressPublishedUrl` | Published post URL | `apps/dashboard/src/app/api/content/[id]/wordpress/publish/route.ts:146` |

## API Integration Workflow

**Location:** `apps/dashboard/src/app/api/content/[id]/wordpress/publish/route.ts:18-157`

### Step-by-Step Publishing Flow

1. **Verify Session & Authorization** (lines 23-24)
   - Authenticate user via Better Auth
   - Verify `PUBLISHING_PUBLISH` permission

2. **Load Post** (lines 29-36)
   - Fetch post by ID with workspace relation
   - Throw 404 if not found or workspace mismatch

3. **Check Publish Gate** (lines 51-70)
   - Validate no unresolved critical risk flags
   - If blocked without override, return 409 with flag details
   - Allow owner role to bypass via `overrideRiskFlags: true`

4. **Fetch WordPress Connection** (lines 73-93)
   - Retrieve workspace's WordPress credentials
   - Throw error if no connection configured

5. **Decrypt Credentials** (lines 98-103)
   - Decrypt stored Application Password
   - Handle decryption failures gracefully

6. **Convert Markdown to HTML** (lines 119)
   - Transform post markdown to HTML via `markdownToHtml()`

7. **Publish to WordPress** (lines 122-140)
   - Instantiate `WordPressClient` with decrypted credentials
   - Call `createPost()` with post data
   - Catch network/API errors, return 502 with message

8. **Update Post Record** (lines 143-149)
   - Store `wordpressPostId` and `wordpressPublishedUrl`
   - Enable future republish operations

9. **Return Success** (lines 152-156)
   - Return published URL and WordPress post ID

## Settings & Configuration

### Workspace WordPress Configuration

**API Routes:**

**GET `/api/workspace/[slug]/wordpress`** — Retrieve connection status
- Returns: `{ connected: true, siteUrl: "...", username: "..." }`
- Or: `{ connected: false }`

**POST `/api/workspace/[slug]/wordpress`** — Save/update connection
- Request body: `{ siteUrl: "...", username: "...", appPassword: "..." }`
- Creates or updates single workspace connection record

**DELETE `/api/workspace/[slug]/wordpress`** — Disconnect
- Sets `isActive: false` on connection record

**Location:** `apps/dashboard/src/app/api/workspace/[slug]/wordpress/route.ts:15-154`

### Site URL Normalization

**Location:** `apps/dashboard/src/lib/wordpress/client.ts:60-82`

The client automatically normalizes site URLs to ensure correct API endpoint resolution:

- `https://mysite.com` → `https://mysite.com/wp-json/wp/v2`
- `https://mysite.wordpress.com` → `https://mysite.wordpress.com/wp-json/wp/v2`
- `https://mysite.com/wp-json` → `https://mysite.com/wp-json/wp/v2`
- `https://mysite.com/wp-json/wp/v2` → `https://mysite.com/wp-json/wp/v2` (no-op)

## Error Handling

### Common Errors

**Error: "No WordPress connection configured for this workspace"**
- **Cause:** User attempts to publish without saving WordPress credentials
- **Recovery:** User navigates to Settings → Integrations, enters site URL + credentials, clicks Test Connection
- **Retry:** Yes, after connection is saved

**Error: "Failed to decrypt stored credentials"**
- **Cause:** `BETTER_AUTH_SECRET` env var changed or corrupted credentials in database
- **Recovery:** User must re-enter credentials in Settings (old encrypted value is overwritten)
- **Retry:** Yes, after credential re-entry

**Error: "WordPress API error: 401"**
- **Cause:** Application Password revoked or incorrect username
- **Recovery:** User generates new Application Password in WordPress admin, updates Settings
- **Retry:** Yes, after new password generated

**Error: "WordPress API error: 400"**
- **Cause:** Invalid post data (missing title, bad category ID, etc.)
- **Recovery:** Check validation before publish; post may be missing required metadata
- **Retry:** No; fix data first, then retry

**Error: "WordPress API error: 502 / 503"**
- **Cause:** WordPress site temporarily down or unreachable
- **Recovery:** Wait for site recovery, then retry
- **Retry:** Yes, exponential backoff recommended

### Retry Strategy

**Location:** `apps/dashboard/src/app/api/content/[id]/wordpress/publish/route.ts:125-140`

Current implementation: **No automatic retry**. Errors returned to client as 502/error object. Client may implement retry via `/retry` endpoint or user-initiated resubmit.

**Recommended Strategy** (not yet implemented):
```typescript
async function publishWithRetry(maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await client.createPost(params);
    } catch (err) {
      if (isRetryable(err) && i < maxAttempts - 1) {
        await sleep(Math.pow(2, i) * 1000);  // 1s, 2s, 4s
        continue;
      }
      throw err;
    }
  }
}
```

## Rate Limits

WordPress REST API rate limits depend on site hosting:

- **WordPress.com Jetpack**: 25 requests per 15 seconds per IP (enterprise plans higher)
- **Self-hosted**: No built-in rate limits (depends on web server config)

**Handling Strategy:** Current implementation does not enforce client-side rate limiting. High-volume publishing should implement:
- Queue-based publishing (Upstash QStash integration exists)
- Per-workspace publish cooldown (1 second between publishes)
- Graceful error messaging for rate-limit responses (429 status)

## Testing

### Test Credentials

Obtain via:
1. Self-hosted WordPress: WP Admin → Users → Edit User → Application Passwords section
2. WordPress.com Jetpack: WordPress.com Account → Security → Application Passwords

**Sandbox URL:** Not applicable (use real WordPress site for testing)

### Integration Test Example

```typescript
// Test flow: save connection → publish → verify URL
const client = new WordPressClient(
  "https://test-site.local",
  "testuser",
  "xxxx xxxx xxxx xxxx xxxx xxxx"
);

// Verify connection
const site = await client.testConnection();
console.assert(site.id > 0);

// Fetch categories for selection
const cats = await client.getCategories();
console.assert(cats.length > 0);

// Publish post
const post = await client.createPost({
  title: "Test Post",
  htmlContent: "<p>Test content</p>",
  status: "draft"
});
console.assert(post.id > 0 && post.link);
```

## Monitoring

### Health Checks

**Endpoint:** `GET /api/integrations/health/check?integrationKey=wordpress`

Returns: `{ status: "healthy" | "unhealthy", lastChecked: ISO8601 }`

**Frequency:** On-demand (no automatic polling currently implemented)

**Location:** `apps/dashboard/src/lib/integrations/health-checker.ts`

### Metrics to Track

- Connection test success rate (% successful credential verification)
- Average publish latency (time from request to WordPress confirmation)
- Error rate by type (authentication, network, validation, etc.)
- Recovered publishes (retries after initial failure)

## Security Considerations

- **Credentials at rest:** AES-256-CBC encrypted, key derived from BETTER_AUTH_SECRET
- **Credentials in transit:** HTTPS only (enforced; HTTP URLs rejected)
- **Application Password scope:** Limited to WordPress REST API (no admin access)
- **Audit trail:** All publishes stored in `posts` table with `wordpressPostId` link-back
- **Workspace isolation:** Each workspace has max 1 WordPress connection; no cross-workspace sharing

## Compliance

**Data Handling:**
- PII: Post author name and email not transmitted to WordPress (only post title/content)
- Retention: WordPress URLs stored indefinitely for post history
- Geographic: No geo restrictions; requests route to WordPress site's hosting location

**Regulations:**
- **GDPR:** Posts deleted from SessionForge persist on WordPress; user responsible for removal via WordPress admin
- **CCPA:** No PII collected; only post content sent to WordPress

## Cost Considerations

**Pricing Model:** WordPress.com Jetpack (free tier allows REST API; business tier has priority support)

**Cost per publish:** Free for self-hosted WordPress; Jetpack fees apply per WordPress.com site (separate from SessionForge billing)

**Monthly estimate:** $0 for self-hosted (unlimited); varies by WordPress.com plan

## Related Documentation

- **Publishing Pipeline:** [publishing-guide.md](../publishing-guide.md) — Full content publication workflow
- **Integrations:** [integrations-overview.md](../integrations-overview.md) — All third-party integrations
- **Risk Flags:** `apps/dashboard/src/lib/verification/publish-gate.ts` — Pre-publish validation
- **Hashnode Integration:** [interfaces/hashnode-publishing.md](./hashnode-publishing.md)
- **Dev.to Integration:** [interfaces/devto-publishing.md](./devto-publishing.md)

## External Resources

- [WordPress REST API Handbook](https://developer.wordpress.org/rest-api/)
- [WordPress Application Passwords](https://wordpress.org/support/article/application-passwords/)
- [WordPress REST API Authentication](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/)
- [Jetpack Documentation](https://jetpack.com/support/jetpack-features/)

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial interface documentation | docs-manager |
| 2026-02-15 | WordPress publishing feature completed | executor |
