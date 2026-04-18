# SessionForge Integration Guides

**Version:** 0.5.1-alpha

---

## Overview

SessionForge supports **3 primary publishing integrations** and **5 extended integrations** for analytics and content enrichment.

### Primary Publishing Integrations (Focus)

| Platform | Auth Model | Capabilities |
|---|---|---|
| Hashnode | API Token (PAT) | Publish blog posts with canonical URLs |
| Dev.to | API Key | Publish articles, sync updates |
| WordPress | Application Password (AES-encrypted) | Publish posts to self-hosted or WordPress.com |

### Extended Integrations

| Platform | Auth Model | Capabilities |
|---|---|---|
| Ghost | Admin API Key (JWT) | Publish posts (draft/published/scheduled) |
| Medium | OAuth 2.0 | Publish to user profile or publications |
| Twitter / X | OAuth 2.0 (PKCE) | Publish threads, analytics sync |
| LinkedIn | OAuth 2.0 | Publish posts, analytics sync |
| GitHub | OAuth 2.0 | Repository sync, commit/PR/issue data, activity feed |

All integrations are configured per-workspace in **Settings > Integrations**. Each platform stores its credentials encrypted in the database.

---

## Token-Based Integrations

These integrations use API keys or tokens that users paste directly in the settings UI. No OAuth redirect flow is required.

### Hashnode

**Setup:**
1. Generate a Personal Access Token (PAT) at [hashnode.com/settings/developer](https://hashnode.com/settings/developer)
2. Paste the token in Settings > Integrations > Hashnode
3. Provide your Hashnode Publication ID and optional canonical domain

**Configuration stored in:** `integration_settings` table (`hashnode_api_token`, `hashnode_publication_id`)

**Publishing:**
- Posts are published via the Hashnode GraphQL API
- Supports canonical URL configuration for SEO
- Published URL is stored on the `posts.hashnode_url` column

**Client:** `src/lib/publishing/hashnode.ts`

**API routes:** `GET/POST/DELETE /api/integrations/hashnode`

---

### Dev.to

**Setup:**
1. Generate an API key at [dev.to/settings/extensions](https://dev.to/settings/extensions)
2. Paste the key in Settings > Integrations > Dev.to
3. Username is verified automatically

**Configuration stored in:** `devto_integrations` table

**Publishing format:**
- Content sent as Markdown via `body_markdown`
- Supports tags (up to 4), canonical URL, and series grouping
- Can publish as draft or live
- Supports article updates after initial publish

**Client:** `src/lib/integrations/devto.ts`

```typescript
// Key functions
verifyDevtoApiKey(apiKey)        // Validate key, get username
publishToDevto(apiKey, article)  // Create article
updateDevtoArticle(apiKey, id, article)  // Update existing
```

**API routes:**
- `GET/POST/DELETE /api/integrations/devto` -- credential management
- `GET/POST/PUT /api/integrations/devto/publish` -- publish and sync

**Limitations:**
- Maximum 4 tags per article
- Rate limiting (429 responses handled with retry guidance)
- No image upload API -- images must be hosted externally

---

### Ghost

**Setup:**
1. Create a Custom Integration in your Ghost Admin panel (Settings > Integrations)
2. Copy the Admin API Key (format: `{id}:{secret}`)
3. Paste the key and your Ghost URL in Settings > Integrations > Ghost

**Configuration stored in:** `ghost_integrations` table (`ghost_url`, `admin_api_key`)

**Authentication:** Ghost uses JWT tokens generated from the Admin API key. The client splits the key into `{id}:{secret}`, creates a short-lived JWT (5 min expiry), and signs it with HMAC-SHA256.

**Publishing format:**
- Content sent as HTML or Lexical JSON
- Supports tags, authors, featured images, canonical URLs
- Visibility controls: `public`, `members`, `paid`
- Custom excerpts for previews

**Client:** `src/lib/integrations/ghost.ts`

```typescript
// Key functions
verifyGhostApiKey(adminApiKey, ghostUrl)   // Validate credentials
publishToGhost(adminApiKey, ghostUrl, post) // Create post
updateGhostPost(adminApiKey, ghostUrl, id, post) // Update existing
```

**API routes:**
- `GET/POST/DELETE /api/integrations/ghost` -- credential management
- `GET/POST/PUT /api/integrations/ghost/publish` -- publish and sync

---

### WordPress

**Setup:**
1. Enable Application Passwords in your WordPress installation (WordPress 5.6+)
2. Generate an Application Password at Users > Profile > Application Passwords
3. Enter your site URL, username, and app password in Settings > Integrations > WordPress

**Security:** App passwords are encrypted with AES-256 using the `SCAN_SOURCE_ENCRYPTION_KEY` environment variable before storage in the database. Required for all deployments (local Docker, Neon, self-hosted).

**Configuration stored in:** `wordpress_connections` table

**Publishing:** Uses the WordPress REST API (`/wp-json/wp/v2/posts`) with Basic Authentication. Published URL and post ID are stored on the `posts` table.

**Client:** `src/lib/wordpress/client.ts`

**API routes:**
- `GET/POST/DELETE /api/integrations/wordpress` -- credential management
- `POST /api/integrations/wordpress/publish` -- publish content

---

## OAuth Integrations

These integrations use redirect-based OAuth flows. Users click "Connect" in settings, authorize in the platform's UI, and are redirected back with tokens.

### Twitter / X

**Setup:**
1. Create a Twitter Developer App at [developer.twitter.com](https://developer.twitter.com/)
2. Configure OAuth 2.0 with PKCE (User Authentication Settings)
3. Set the callback URL to `{NEXT_PUBLIC_APP_URL}/api/integrations/twitter/callback`
4. Add `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` environment variables

**OAuth flow:** OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
- Code verifier/challenge stored in secure HTTP-only cookies during the flow

**Configuration stored in:** `twitter_integrations` table (per workspace)

**Capabilities:**
- Fetch tweet analytics (impressions, likes, retweets, replies, clicks, quotes)
- Paginated timeline retrieval with `next_token` pagination

**Client:** `src/lib/integrations/twitter.ts`

```typescript
// Key functions
verifyTwitterAuth(accessToken)    // Validate token, get user info
getTweetAnalytics(accessToken, userId, options)  // Fetch engagement data
getTweetById(accessToken, tweetId)  // Single tweet metrics
```

**API routes:**
- `GET/DELETE /api/integrations/twitter` -- connection management
- `GET /api/integrations/twitter/oauth` -- initiate OAuth flow
- `GET /api/integrations/twitter/callback` -- handle OAuth callback

---

### LinkedIn

**Setup:**
1. Create a LinkedIn App at [linkedin.com/developers](https://www.linkedin.com/developers/)
2. Request the Sign In with LinkedIn product
3. Set the callback URL to `{NEXT_PUBLIC_APP_URL}/api/integrations/linkedin/callback`
4. Add `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` environment variables

**OAuth flow:** Standard OAuth 2.0
- Scopes: `openid`, `profile`, `w_member_social`
- State parameter stored in secure HTTP-only cookies for CSRF protection

**Configuration stored in:** `linkedin_integrations` table (per workspace)

**Capabilities:**
- Fetch post analytics (impressions, likes, comments, reposts, clicks)
- Paginated post retrieval

**Client:** `src/lib/integrations/linkedin.ts` (uses LinkedIn v2 API with `X-Restli-Protocol-Version: 2.0.0` header)

**API routes:**
- `GET/DELETE /api/integrations/linkedin` -- connection management
- `GET /api/integrations/linkedin/oauth` -- initiate OAuth flow
- `GET /api/integrations/linkedin/callback` -- handle OAuth callback

---

### Medium

**Setup:**
1. Create a Medium Application at [medium.com/me/applications](https://medium.com/me/applications)
2. Set the callback URL to `MEDIUM_REDIRECT_URI`
3. Add `MEDIUM_CLIENT_ID`, `MEDIUM_CLIENT_SECRET`, and `MEDIUM_REDIRECT_URI` environment variables

**OAuth flow:** Standard OAuth 2.0
- Scopes: `basicProfile`, `publishPost`
- Token exchange at `https://api.medium.com/v1/tokens`

**Configuration stored in:** `medium_integrations` table

**Publishing format:**
- Content sent as Markdown (`contentFormat: "markdown"`) or HTML
- Publish status: `draft`, `public`, `unlisted`
- Supports tags, canonical URLs, and follower notifications
- Can publish to user profile or to a specific publication

**Client:** `src/lib/integrations/medium.ts`

```typescript
// Key functions
verifyMediumToken(accessToken)    // Validate, get user profile
getMediumPublications(accessToken, userId)  // List user's publications
publishToMedium(accessToken, userId, article)  // Publish to profile
publishToMediumPublication(accessToken, pubId, article)  // Publish to publication
```

**API routes:**
- `GET/POST/DELETE /api/integrations/medium` -- credential management
- `GET /api/integrations/medium/oauth` -- initiate OAuth flow
- `GET /api/integrations/medium/callback` -- handle OAuth callback
- `POST /api/integrations/medium/publish` -- publish content

---

### GitHub

**Setup:**
1. Create a GitHub OAuth App at [github.com/settings/developers](https://github.com/settings/developers)
2. Set the callback URL to `{NEXT_PUBLIC_APP_URL}/api/auth/callback/github`
3. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` environment variables
4. Optionally configure `GITHUB_WEBHOOK_SECRET` for push event sync

**Configuration stored in:** `github_integrations` table

**Capabilities:**
- Sync repositories, commits, pull requests, and issues
- Activity feed for development context
- Privacy controls to exclude specific repos or commits from content
- Webhook support for real-time push event processing

**Client:** `src/lib/integrations/github.ts` (uses GitHub REST API v3 with `2022-11-28` API version header)

```typescript
// Key functions
verifyGitHubToken(accessToken)     // Validate token
fetchGitHubRepositories(accessToken, options)  // List repos
fetchGitHubCommits(accessToken, owner, repo, options)  // Commit history
fetchGitHubPullRequests(accessToken, owner, repo, options)  // PR list
fetchGitHubIssues(accessToken, owner, repo, options)  // Issue list
```

**API routes:**
- `GET/POST /api/integrations/github` -- connection management
- `GET/POST/DELETE /api/integrations/github/repos` -- repository sync
- `POST /api/integrations/github/sync` -- manual data sync
- `GET /api/integrations/github/activity` -- activity feed
- `GET/POST/DELETE /api/integrations/github/privacy` -- exclusion settings
- `POST /api/integrations/github/webhooks` -- webhook receiver

---

## Integration Architecture

All integration clients follow a consistent pattern:

1. **Typed client class** in `src/lib/integrations/<platform>.ts`
2. **Error classification** -- each client maps HTTP status codes to typed error codes (`invalid_api_key`, `rate_limited`, `forbidden`, etc.)
3. **Verify function** -- validates credentials before saving
4. **Per-workspace storage** -- each integration has its own DB table with a unique constraint on `workspaceId`
5. **Publication tracking** -- per-platform publication tables link `postId` to the external article ID and URL

### Adding a New Integration

1. Define the integration + publication tables in `packages/db/src/schema.ts`
2. Create a client in `src/lib/integrations/<platform>.ts` with `verify`, `publish`, and `update` functions
3. Add API routes under `src/app/api/integrations/<platform>/`
4. Add the relation to `workspacesRelations` and `postsRelations` in the schema
5. Add UI in the Settings > Integrations tab

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full integration architecture diagram and [code-standards.md](./code-standards.md) for API route conventions.

---

**Last Updated:** March 2026
