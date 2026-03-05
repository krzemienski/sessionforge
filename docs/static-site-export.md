# Static Site Export

**Version:** 1.0.0
**Updated:** 2026-03-05

---

## Table of Contents

1. [Overview](#overview)
2. [Collections & Series](#collections--series)
3. [Themes](#themes)
4. [Exporting a Static Site](#exporting-a-static-site)
5. [ZIP Package Contents](#zip-package-contents)
6. [Sitemap & RSS Feed](#sitemap--rss-feed)
7. [Custom Domains](#custom-domains)
8. [CI Auto-Deploy](#ci-auto-deploy)
9. [API Reference](#api-reference)
10. [Deployment Guides](#deployment-guides)

---

## Overview

SessionForge can export any **collection** or **series** of posts as a complete, self-contained static website — HTML, CSS, and JavaScript bundled into a downloadable ZIP.

The exported site:

- Deploys to GitHub Pages, Netlify, Vercel, Cloudflare Pages, or any static host
- Includes a `sitemap.xml` and `rss.xml` for SEO and feed readers
- Ships with three built-in themes covering portfolios, blogs, and changelogs
- Generates a GitHub Actions workflow (`.github/workflows/deploy.yml`) for automatic CI redeployment
- Achieves a 90+ Lighthouse performance score on the exported HTML

---

## Collections & Series

### Collections

A **collection** is an ordered group of posts that will be exported together as one static site.

| Field | Description |
|---|---|
| `name` | Display name shown in the site header |
| `slug` | URL-safe identifier used in the export filename |
| `description` | Optional subtitle shown on the site index |
| `theme` | Default theme for this collection (`minimal-portfolio`, `technical-blog`, `changelog`) |
| `customDomain` | Optional custom domain — used to generate a `CNAME` file |

### Series

A **series** is a typed sequence of posts intended to be read in order (e.g., a multi-part tutorial or release notes history). Series share the same export API as collections.

### Creating a Collection

1. Navigate to **`/{workspace}/collections`** in the dashboard.
2. Click **New Collection**.
3. Fill in the name, slug, description, and choose a default theme.
4. Click **Create**.

### Adding Posts

1. Open the collection detail page.
2. Click **Add Post** and select from your content library.
3. Drag posts to reorder them — the order is preserved in the exported index page.

---

## Themes

Three built-in themes are available. All themes support:

- Dark/light mode toggle (persists via `localStorage`, respects OS preference)
- Code syntax highlighting via [highlight.js](https://highlightjs.org/) with 40+ languages
- Responsive layout (mobile, tablet, desktop)
- Accessible HTML with proper heading hierarchy and ARIA attributes
- CSS custom properties for easy customisation

### `minimal-portfolio`

A clean, minimalist theme suited for developer portfolios and personal sites.

- Single-column article layout
- Hero section with author name, tagline, and social links
- Post cards with date, estimated reading time, and tag badges
- Sans-serif typography with generous white space

### `technical-blog`

A reading-focused theme with navigation aids for long-form technical content.

- Reading progress bar at the top of the page
- Auto-generated table of contents (sidebar on desktop, collapsible on mobile)
- IntersectionObserver-based active section highlighting in the TOC
- Copy-to-clipboard buttons on all code blocks
- Post excerpt on the index listing page
- Warm teal colour palette, distinct from the portfolio theme

### `changelog`

A timeline-based theme for release notes and version histories.

- Chronological timeline with version badges
- Change-type badge colouring: **Added** (green), **Changed** (blue), **Fixed** (purple), **Deprecated** (yellow), **Removed** (red), **Security** (orange)
- Version anchors (`#v1-2-0`) for deep-linking to specific releases
- Monospace version numbers for visual consistency

---

## Exporting a Static Site

### Via the UI

1. Open a collection detail page.
2. Click **Export Site**.
3. In the export modal:
   - Select a **theme**.
   - Optionally enter a **custom domain** (e.g. `blog.example.com`).
4. Click **Download ZIP**.

The ZIP file downloads to your browser. Extract it and open `index.html` locally, or deploy the contents to any static host.

### Via the API

```http
GET /api/collections/{collectionId}/export?theme=technical-blog&domain=blog.example.com
Authorization: Bearer <token>
```

The response is a `application/zip` file download.

**Query parameters:**

| Parameter | Required | Default | Description |
|---|---|---|---|
| `theme` | No | Collection's saved theme or `technical-blog` | Theme to use for the export |
| `domain` | No | — | Custom domain — creates a `CNAME` file in the ZIP |

**Response headers:**

| Header | Value |
|---|---|
| `Content-Type` | `application/zip` |
| `Content-Disposition` | `attachment; filename="<slug>-static-site.zip"` |
| `X-Export-Count` | Number of posts included in the export |

---

## ZIP Package Contents

```
<slug>-site/
├── index.html              # Collection index / post listing
├── sitemap.xml             # XML sitemap for search engines
├── rss.xml                 # RSS 2.0 feed
├── CNAME                   # Only present if custom domain is set
├── .nojekyll               # Prevents GitHub Pages from running Jekyll
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions CI workflow (auto-deploy on push)
└── posts/
    └── <slug>/
        └── index.html      # Individual post page (CSS/JS inlined)
```

All CSS and JavaScript are **inlined** into each HTML file, so the site works correctly when opened from the filesystem (`file://`) without a local web server.

---

## Sitemap & RSS Feed

### sitemap.xml

The sitemap is generated following the [sitemaps.org protocol](https://www.sitemaps.org/protocol.html).

- The index page (`/`) is listed with `changefreq: monthly` and `priority: 1.0`.
- Each post page is listed with `changefreq: monthly` and `priority: 0.8`.
- `lastmod` is set to the post's `updatedAt` timestamp in `YYYY-MM-DD` format.

Submit the sitemap URL to Google Search Console after deploying to improve indexing speed.

### rss.xml

The RSS 2.0 feed includes:

- Channel metadata: title, description, site URL, and build date
- Up to 50 posts sorted by publication date (newest first)
- Per-item: title, link, `guid`, `pubDate`, and a plain-text excerpt (first 500 characters)

The feed URL follows the pattern: `https://<your-domain>/rss.xml`

---

## Custom Domains

To serve the exported site from a custom domain:

1. Enter your domain in the export modal (e.g. `blog.example.com`).
2. The ZIP will contain a `CNAME` file with the domain as its contents.
3. Follow the host-specific setup instructions in [GitHub Pages Setup](./github-pages-setup.md).

For a bare apex domain (`example.com`) you will need to configure `A` records at your DNS provider instead of a `CNAME`.

---

## CI Auto-Deploy

The ZIP includes a pre-configured GitHub Actions workflow at `.github/workflows/deploy.yml`.

```yaml
name: Deploy static site to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - uses: actions/deploy-pages@v4
        id: deployment
```

**How to use it:**

1. Extract the ZIP into the root of a GitHub repository (or a `docs/` subdirectory).
2. Commit and push to `main`.
3. In the repository **Settings → Pages**, set the source to **GitHub Actions**.
4. The site deploys automatically on every push.

To trigger a redeploy when you publish new content in SessionForge, re-export the collection and push the updated files to the repository.

---

## API Reference

### Collections

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/collections` | List collections for workspace |
| `POST` | `/api/collections` | Create a new collection |
| `GET` | `/api/collections/{id}` | Get collection detail |
| `PUT` | `/api/collections/{id}` | Update collection |
| `DELETE` | `/api/collections/{id}` | Delete collection |
| `GET` | `/api/collections/{id}/posts` | List posts in collection |
| `POST` | `/api/collections/{id}/posts` | Add post to collection |
| `DELETE` | `/api/collections/{id}/posts` | Remove post from collection |
| `GET` | `/api/collections/{id}/export` | Download static site ZIP |

### Series

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/series` | List series for workspace |
| `POST` | `/api/series` | Create a new series |
| `GET` | `/api/series/{id}` | Get series detail |
| `PUT` | `/api/series/{id}` | Update series |
| `DELETE` | `/api/series/{id}` | Delete series |
| `GET` | `/api/series/{id}/export` | Download static site ZIP |

All endpoints require an `Authorization: Bearer <token>` header and a `?workspace=<slug>` query parameter on list endpoints.

---

## Deployment Guides

See [GitHub Pages Setup](./github-pages-setup.md) for step-by-step deployment instructions covering:

- GitHub Pages (free, custom domain, HTTPS)
- Netlify (drag-and-drop and CI deploys)
- Vercel Static
- Cloudflare Pages

---

## Attribution

Exported sites include a **"Powered by SessionForge"** link in the footer by default. This attribution helps grow the SessionForge community.

**Paid plan users** may remove the footer link from the collection settings.
