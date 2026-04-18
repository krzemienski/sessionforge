# Dev.to Publishing Integration

> **Category:** External Interface
> **Service:** Dev.to API
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

**Service:** Dev.to Publishing Platform
**Provider:** Dev.to
**Purpose:** Publish and update articles on the Dev.to platform
**Documentation:** https://developers.forem.com/api

## Authentication

### Method

API Key (Bearer Token via api-key header)

### Credentials Management

**Location:** User workspace settings (API Keys section)

**Environment Variables:**
```bash
# Dev.to API key is stored per workspace and retrieved from workspace integrations
```

**Setup:**
Users must provide their Dev.to API key via the dashboard Settings → Integrations → Dev.to section. The key is stored in the workspace's integration settings.

**Verification:**
```typescript
import { verifyDevtoApiKey } from "@/lib/integrations/devto";

const user = await verifyDevtoApiKey(apiKey);
// Returns: { username: string, name: string }
```

## API Endpoints Used

### getUser() — Verify Credentials

**URL:** `GET /api/users/me`
**Purpose:** Verify API key validity and retrieve current user info

**Request:**
```typescript
// No request body; API key passed in header
```

**Response:**
```typescript
{
  username: string,
  name: string,
}
```

### publishToDevto() — Publish Article

**URL:** `POST /api/articles`
**Purpose:** Create and publish a new article

**Request:**
```typescript
{
  article: {
    title: string,
    body_markdown: string,
    published: boolean,
    tags: string[],
    canonical_url?: string,
    series?: string,
  }
}
```

**Response:**
```typescript
{
  id: number,
  url: string,
  published: boolean,
}
```

### updateDevtoArticle() — Update Article

**URL:** `PUT /api/articles/{articleId}`
**Purpose:** Update an existing article

**Request:**
```typescript
{
  article: Partial<DevtoArticleInput>,
}
```

**Response:**
```typescript
{
  id: number,
  url: string,
  published: boolean,
}
```

## Error Handling

### Common Errors

**Error 1: Invalid API Key**
- **Cause:** API key invalid or revoked
- **Code:** `invalid_api_key` (HTTP 401)
- **Recovery:** User must re-authenticate in Settings
- **Retry:** No

**Error 2: Validation Error**
- **Cause:** Article content invalid (missing title, invalid tags)
- **Code:** `validation_error` (HTTP 422)
- **Recovery:** Fix article content and retry
- **Retry:** Yes, after content correction

**Error 3: Rate Limit**
- **Cause:** Too many requests in short time
- **Code:** `rate_limited` (HTTP 429)
- **Recovery:** Implement exponential backoff (1s, 2s, 4s)
- **Retry:** Yes, with backoff

### Retry Strategy

```typescript
async function publishToDevtoWithRetry(
  apiKey: string,
  article: DevtoArticleInput,
  maxRetries = 3
) {
  let delay = 1000;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await publishToDevto(apiKey, article);
    } catch (err) {
      if (err instanceof DevtoApiError && err.code === "rate_limited" && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}
```

## Data Mapping

### Our Model → Dev.to

| Our Field | Dev.to Field | Transformation |
|---|---|---|
| `title` | `article.title` | Direct |
| `body` | `article.body_markdown` | Markdown text |
| `published` | `article.published` | Boolean |
| `tags` | `article.tags` | Array of strings |
| `canonicalUrl` | `article.canonical_url` | Optional URL |
| `series` | `article.series` | Optional series name |

### Dev.to → Our Model

| Dev.to Field | Our Field | Transformation |
|---|---|---|
| `article.id` | `devtoArticleId` | Store for updates |
| `article.url` | `publishedUrl` | Direct link |
| `article.published` | `status` | Map to "published" |

## Testing

### Test Credentials

Dev.to does not provide a sandbox environment. Testing must use a real dev.to account with test articles.

### Test Flow

```typescript
test("publish article to Dev.to", async () => {
  const apiKey = process.env.DEVTO_TEST_API_KEY;
  if (!apiKey) skip();
  
  const result = await publishToDevto(apiKey, {
    title: "Test Article",
    body_markdown: "# Hello\nThis is a test.",
    published: false, // Keep unpublished for testing
    tags: ["test"],
  });
  
  expect(result.id).toBeTruthy();
  expect(result.url).toMatch(/dev.to/);
});
```

## Monitoring

### Health Checks

**Endpoint:** https://dev.to/api/users/me
**Frequency:** On integration enable, before bulk publish

### Metrics to Track

- Publish success rate
- Validation errors (invalid tags, title length)
- Rate limit errors
- Average publish latency

### Alerts

- **Critical:** Auth failures (invalid API key)
- **Warning:** Validation errors (>10% in 1h window)
- **Warning:** Rate limiting detected

## Security Considerations

- API keys stored hashed in workspace settings (never logged)
- No article body stored locally (streamed directly)
- Canonical URL prevents duplicate content penalties
- Series field optional (prevents cross-posting issues)

## Compliance

**Data Handling:**
- PII fields: None stored locally; articles published on Dev.to
- Retention: Articles owned by Dev.to account
- Geographic restrictions: Dev.to available globally

**Regulations:**
- GDPR: User controls all content via Dev.to account
- CCPA: Deletion of articles requires user action on Dev.to

## Related Documentation

- [Patterns: Publishing Integration](../patterns/publishing-integration.md) — how integrations work
- [Interfaces: Hashnode Publishing](./hashnode-publishing.md) — similar publishing service

## External Resources

- [Dev.to API Documentation](https://developers.forem.com/api)
- [Dev.to Terms of Service](https://dev.to/terms)

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial integration | capture-docs |
