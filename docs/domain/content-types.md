# Content Types Domain

> **Category:** Domain Model
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

Content types define the kinds of output that the SessionForge pipeline can generate from session data. Each type has distinct formats, publishing destinations, and optimization parameters.

## Types

### 1. blog_post

**Purpose:** Long-form written content (500-2000 words)

**Format:** Markdown with Lexical rich text

**Publishing:** Hashnode, Dev.to, WordPress, custom blogs

**Characteristics:**
- Includes title, subtitle, body, tags, featured image
- SEO metadata (meta description, canonical URL)
- Supports internal citations and linked insights
- Revision history tracked

**Example Generation:** AI blog-writer agent processes session data to extract narrative arcs, transforms into structured blog post with introduction, key insights, and conclusion.

### 2. twitter_thread

**Purpose:** Social media thread content (5-15 tweets max)

**Format:** Plain text, line breaks = tweet breaks

**Publishing:** Twitter/X direct link

**Characteristics:**
- Each tweet ≤280 characters
- Numbered (1/N, 2/N format)
- Hashtags and mentions supported
- Typically 1-3 minute read

**Example Generation:** Extracted insights condensed into 7-tweet thread with natural flow and CTA at end.

### 3. linkedin_post

**Purpose:** Professional social content (300-500 words)

**Format:** Plain text with emoji and line breaks

**Publishing:** LinkedIn direct link

**Characteristics:**
- Longer than Twitter thread
- Professional tone expected
- Hashtags for discovery
- Engagement hooks (questions, calls-to-action)

**Example Generation:** Session highlights reframed for professional audience, emphasizing lessons learned and actionable takeaways.

### 4. devto_post

**Purpose:** Developer-focused article (same as blog_post but platform-specific)

**Format:** Markdown

**Publishing:** Dev.to platform API

**Characteristics:**
- Covers development, tools, career, community
- Tags limit to 4 per article
- Series support (multi-part articles)
- Canonical URL prevents duplicate content penalties

**Example Generation:** Technical insights extracted and formatted for Dev.to's developer audience.

### 5. changelog

**Purpose:** Document updates and improvements (changelog entry)

**Format:** Markdown with structured format

**Publishing:** Changelog page, email newsletter

**Characteristics:**
- Typically 50-200 words per entry
- Categorized (Added, Fixed, Improved, Deprecated, Removed)
- Version number required
- Date-stamped

**Example Generation:** Automation changes, tool updates, and process improvements formatted as changelog entries.

### 6. newsletter

**Purpose:** Email newsletter content (500-1500 words)

**Format:** HTML + plain text fallback

**Publishing:** Email subscribers (Mailchimp, custom list)

**Characteristics:**
- Includes header/footer template
- Section headers for readability
- CTA (call-to-action) button
- Unsubscribe link required

**Example Generation:** Weekly digest of top insights and content, with manual curation and scheduling.

### 7. custom

**Purpose:** User-defined custom format

**Format:** Any (user specifies)

**Publishing:** No default publishing (user handles)

**Characteristics:**
- Template-driven generation
- User provides format and structure
- No platform-specific constraints
- Suitable for internal documents, reports, analysis

**Example Generation:** Custom report format for client deliverables or internal documentation.

### 8. doc_page

**Purpose:** Documentation or knowledge base article

**Format:** Markdown with code blocks

**Publishing:** Docs site, wiki, knowledge base

**Characteristics:**
- Structured with headers (h1, h2, h3)
- Code examples with syntax highlighting
- Table of contents auto-generated
- Searchable and cross-linkable

**Example Generation:** Process documentation, API reference, or procedural guide extracted from session insights.

## Database Model

```typescript
export const contentTypeEnum = pgEnum("content_type", [
  "blog_post",
  "twitter_thread",
  "linkedin_post",
  "devto_post",
  "changelog",
  "newsletter",
  "custom",
  "doc_page",
]);

// Used in posts table:
type ContentType = typeof contentTypeEnum.enumValues[number];
```

## Content Type Properties

| Type | Min Length | Max Length | Publishing | Tags Required | Revision Tracked |
|------|-----------|-----------|-----------|---|---|
| blog_post | 300 words | 5000 words | Yes (3 platforms) | Yes | Yes |
| twitter_thread | 1 tweet | 15 tweets | Yes (Twitter) | Yes | Yes |
| linkedin_post | 150 words | 1000 words | Yes (LinkedIn) | Yes | Yes |
| devto_post | 300 words | 5000 words | Yes (Dev.to) | Yes (4 max) | Yes |
| changelog | 50 words | 500 words | No (email) | Yes | No |
| newsletter | 300 words | 3000 words | No (email) | No | Yes |
| custom | User-defined | User-defined | No (manual) | User-defined | User-defined |
| doc_page | 200 words | 4000 words | Yes (docs) | Yes | Yes |

## Generation Workflow

### For Each Content Type

1. **Extract Insights** — AI extracts key patterns and insights from session
2. **Select Type** — User or automation selects content type
3. **Generate** — Agent generates content in target format
4. **Validate** — Verify length, structure, and completeness
5. **Publish** — Route to appropriate publishing destination

### Type-Specific Agents

| Type | Agent | Model |
|------|-------|-------|
| blog_post | blog-writer | Claude 3.5 Sonnet |
| twitter_thread | social-writer | Claude 3.5 Sonnet |
| linkedin_post | social-writer | Claude 3.5 Sonnet |
| devto_post | blog-writer | Claude 3.5 Sonnet |
| changelog | changelog-writer | Claude 3.5 Sonnet |
| newsletter | newsletter-writer | Claude 3.5 Sonnet |
| custom | user-template-engine | N/A |
| doc_page | doc-writer | Claude 3.5 Sonnet |

## Constraints and Rules

1. **Immutable Type** — Content type cannot change after creation
2. **Format Validation** — Generated content validated against type constraints before publishing
3. **Publishing Routing** — Each type has default publishing destinations
4. **Custom Type Requires Template** — Custom content type requires user-provided template
5. **Multi-Platform Types** — blog_post can be published to multiple platforms simultaneously

## Related Documentation

- [Domain: Workspace Membership](./workspace-membership.md) — who can create content
- [Domain: Agent Run Lifecycle](./agent-run-lifecycle.md) — how content is generated
- [Patterns: Publishing Integration](../patterns/publishing-integration.md) — how content is published

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial domain model | capture-docs |
