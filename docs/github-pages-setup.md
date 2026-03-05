# GitHub Pages Setup Guide

**Version:** 1.0.0
**Updated:** 2026-03-05

---

## Table of Contents

1. [Overview](#overview)
2. [GitHub Pages](#github-pages)
   - [Quick Start](#quick-start)
   - [CI Auto-Deploy (GitHub Actions)](#ci-auto-deploy-github-actions)
   - [Custom Domain](#custom-domain-github-pages)
   - [HTTPS](#https)
3. [Netlify](#netlify)
   - [Drag-and-Drop Deploy](#drag-and-drop-deploy)
   - [CI Deploy via Netlify CLI](#ci-deploy-via-netlify-cli)
   - [Custom Domain (Netlify)](#custom-domain-netlify)
4. [Vercel Static](#vercel-static)
   - [Deploy via Vercel CLI](#deploy-via-vercel-cli)
   - [Custom Domain (Vercel)](#custom-domain-vercel)
5. [Cloudflare Pages](#cloudflare-pages)
   - [Direct Upload](#direct-upload)
   - [Custom Domain (Cloudflare)](#custom-domain-cloudflare)
6. [Troubleshooting](#troubleshooting)

---

## Overview

After [exporting a static site](./static-site-export.md) from SessionForge, you receive a ZIP file containing fully self-contained HTML, CSS, and JavaScript. This guide explains how to deploy that ZIP to four popular static hosting platforms.

**Which platform should I choose?**

| Platform | Free Tier | Custom Domain | HTTPS | Best For |
|---|---|---|---|---|
| GitHub Pages | Yes | Yes | Yes | Open-source projects, developer portfolios |
| Netlify | Yes | Yes | Yes | Instant deploys, form handling |
| Vercel | Yes | Yes | Yes | Next.js projects, edge functions |
| Cloudflare Pages | Yes | Yes | Yes | Global performance, large traffic |

All four platforms support custom domains and HTTPS at no additional cost.

---

## GitHub Pages

### Quick Start

1. **Extract the ZIP** downloaded from SessionForge.

   ```bash
   unzip my-collection-static-site.zip
   cd my-collection-site/
   ```

2. **Create a new GitHub repository** at [github.com/new](https://github.com/new).
   - Set the repository to **Public** (required for the free GitHub Pages tier).
   - Do not initialise with a README — you will push existing files.

3. **Push the extracted files** to the repository root:

   ```bash
   git init
   git add .
   git commit -m "Initial static site deploy"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

4. **Enable GitHub Pages** in the repository settings:
   - Go to **Settings → Pages**.
   - Under **Source**, select **Deploy from a branch**.
   - Set the branch to `main` and the folder to `/ (root)`.
   - Click **Save**.

5. **Visit your site** at `https://<your-username>.github.io/<repo-name>/` — it typically goes live within 30–60 seconds.

> **Note:** The exported ZIP includes a `.nojekyll` file that prevents GitHub Pages from running Jekyll over your files. Do not delete this file.

---

### CI Auto-Deploy (GitHub Actions)

The ZIP includes a pre-configured workflow at `.github/workflows/deploy.yml`. Using the GitHub Actions source (instead of branch deploy) provides faster builds and cleaner deployment logs.

1. **Push the files** to the repository as shown in the Quick Start above.

2. **Change the Pages source** to GitHub Actions:
   - Go to **Settings → Pages**.
   - Under **Source**, select **GitHub Actions**.

3. **Verify the workflow** ran successfully:
   - Go to **Actions** in the repository.
   - You should see a "Deploy static site to GitHub Pages" run in progress or completed.

4. **Trigger future deploys** by re-exporting from SessionForge and pushing the updated files:

   ```bash
   # Replace the site files
   unzip -o my-collection-static-site.zip -d .
   git add .
   git commit -m "Update static site"
   git push
   ```

   The workflow runs automatically on every push to `main`.

The included workflow file:

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

---

### Custom Domain (GitHub Pages)

If you entered a custom domain when exporting from SessionForge, the ZIP already contains a `CNAME` file. If not, you can add one manually.

**Subdomain (e.g. `blog.example.com`)**

1. Add a `CNAME` file to the repository root containing only your domain:

   ```
   blog.example.com
   ```

2. At your DNS provider, add a `CNAME` record:

   | Host | Type | Value |
   |---|---|---|
   | `blog` | CNAME | `<your-username>.github.io` |

3. In **Settings → Pages → Custom domain**, enter `blog.example.com` and click **Save**.

**Apex domain (e.g. `example.com`)**

1. Add a `CNAME` file containing `example.com`.

2. At your DNS provider, add four `A` records pointing to GitHub Pages' IP addresses:

   | Host | Type | Value |
   |---|---|---|
   | `@` | A | `185.199.108.153` |
   | `@` | A | `185.199.109.153` |
   | `@` | A | `185.199.110.153` |
   | `@` | A | `185.199.111.153` |

3. In **Settings → Pages → Custom domain**, enter `example.com` and click **Save**.

DNS changes can take up to 24 hours to propagate.

---

### HTTPS

GitHub Pages enforces HTTPS automatically once DNS is correctly configured.

- In **Settings → Pages**, check **Enforce HTTPS** once the certificate has been provisioned (this takes a few minutes after DNS propagates).
- Do not tick the box before DNS is confirmed — GitHub will show a warning if the domain is not yet verified.

---

## Netlify

### Drag-and-Drop Deploy

This is the fastest way to get a site live with no account setup beyond signing in.

1. **Extract the ZIP** downloaded from SessionForge.

2. Go to [app.netlify.com](https://app.netlify.com) and log in.

3. On the **Sites** dashboard, scroll to the bottom and locate the drag-and-drop zone labelled **"Want to deploy a new site without connecting to Git?"**

4. **Drag the extracted folder** (e.g. `my-collection-site/`) into the drop zone.

5. Netlify uploads the files and assigns a random subdomain such as `random-name-123456.netlify.app`. Your site is live immediately.

6. To change the subdomain, go to **Site settings → General → Site details → Change site name**.

---

### CI Deploy via Netlify CLI

Use this approach to automate redeployment when you publish new content.

1. **Install the Netlify CLI:**

   ```bash
   npm install -g netlify-cli
   ```

2. **Authenticate:**

   ```bash
   netlify login
   ```

3. **Link the site** (run once from the extracted folder):

   ```bash
   netlify init
   ```

   Choose **"Create & configure a new site"** or link to an existing one.

4. **Deploy:**

   ```bash
   netlify deploy --prod --dir .
   ```

5. **Automate future deploys** by adding a script to your workflow or CI:

   ```bash
   # Re-export from SessionForge, unzip, then:
   netlify deploy --prod --dir . --auth $NETLIFY_AUTH_TOKEN --site $NETLIFY_SITE_ID
   ```

   Store `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` as secrets in your CI environment.

---

### Custom Domain (Netlify)

1. Go to **Site settings → Domain management → Domains**.
2. Click **Add custom domain** and enter your domain.
3. Follow the DNS instructions Netlify provides — either update your nameservers to Netlify DNS or add the CNAME/A records at your existing DNS provider.
4. Netlify provisions a free Let's Encrypt certificate automatically once DNS propagates.

---

## Vercel Static

Vercel is primarily optimised for frameworks, but it handles plain static sites well.

### Deploy via Vercel CLI

1. **Install the Vercel CLI:**

   ```bash
   npm install -g vercel
   ```

2. **Authenticate:**

   ```bash
   vercel login
   ```

3. **Deploy from the extracted folder:**

   ```bash
   cd my-collection-site/
   vercel --prod
   ```

   When prompted:
   - **Set up and deploy?** → `Y`
   - **Which scope?** → Select your account or team
   - **Link to existing project?** → `N` (first deploy) or `Y` (subsequent)
   - **Project name** → enter a name or accept the default
   - **In which directory is your code located?** → `.` (current directory)
   - **Override settings?** → `N`

4. Vercel detects no framework and serves the files as a static site. Your deployment URL is printed on completion.

5. **Automate redeployment:**

   ```bash
   vercel --prod --token $VERCEL_TOKEN
   ```

   Store `VERCEL_TOKEN` as a secret in your CI environment.

---

### Custom Domain (Vercel)

1. In the Vercel dashboard, open your project and go to **Settings → Domains**.
2. Enter your domain and click **Add**.
3. Follow the DNS instructions provided — Vercel supports both `CNAME` records (for subdomains) and `A` records (for apex domains).
4. Vercel provisions HTTPS automatically.

---

## Cloudflare Pages

Cloudflare Pages offers free unlimited bandwidth and a global CDN with very fast cold starts.

### Direct Upload

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and select your account.
2. Navigate to **Pages** in the left sidebar.
3. Click **Create a project → Direct Upload**.
4. Give the project a name and click **Create project**.
5. **Upload the extracted folder** using the file picker or drag-and-drop.
6. Click **Deploy site**. Your site is live at `<project-name>.pages.dev`.

**Subsequent deploys via Wrangler CLI:**

```bash
npm install -g wrangler
wrangler pages deploy . --project-name <project-name>
```

Authenticate with:

```bash
wrangler login
```

---

### Custom Domain (Cloudflare)

1. In the Pages project, go to **Custom domains**.
2. Click **Set up a custom domain** and enter your domain.
3. If your domain's DNS is already managed by Cloudflare, the record is added automatically.
4. If not, follow the instructions to add a `CNAME` record at your current DNS provider pointing to `<project-name>.pages.dev`.
5. HTTPS is provided automatically via Cloudflare's Universal SSL.

---

## Troubleshooting

### Site shows a 404 after deploying to GitHub Pages

- **Check the source setting.** In **Settings → Pages**, confirm the source is set to either the correct branch and folder, or GitHub Actions.
- **Check the workflow.** Go to **Actions** and look for errors in the deploy run.
- **Wait a moment.** GitHub Pages can take up to 60 seconds on the first deploy. Hard-refresh your browser (`Ctrl+Shift+R` / `Cmd+Shift+R`).

### CSS or JavaScript is not loading (GitHub Pages subdirectory)

If you deployed to a subdirectory (e.g. `/<repo-name>/`) rather than the root of a custom domain, relative paths in the HTML may not resolve correctly. Re-export the collection with your full custom domain set, or use a custom domain to serve the site from the root path.

### Custom domain shows "Not Secure" or no HTTPS

- **GitHub Pages:** Ensure **Enforce HTTPS** is enabled in **Settings → Pages** and that DNS has fully propagated. Certificate provisioning fails if DNS is still pointing elsewhere.
- **Netlify / Vercel / Cloudflare:** Certificates are provisioned automatically — wait a few minutes after DNS propagates and reload.
- **Check propagation** using a tool such as [dnschecker.org](https://dnschecker.org) before concluding there is an error.

### CNAME file is missing after unzipping

The `CNAME` file is only included in the ZIP if you entered a custom domain in the export modal. Re-export the collection with the domain filled in, or create the file manually:

```bash
echo "blog.example.com" > CNAME
git add CNAME && git commit -m "Add CNAME for custom domain" && git push
```

### Jekyll processes files unexpectedly on GitHub Pages

The ZIP includes a `.nojekyll` file at the root to disable Jekyll processing. If this file is missing (e.g. it was deleted or not extracted), create it:

```bash
touch .nojekyll
git add .nojekyll && git commit -m "Add .nojekyll to disable Jekyll" && git push
```

### Deploy workflow fails with "Resource not accessible by integration"

The GitHub Actions workflow requires `pages: write` and `id-token: write` permissions. These are set in the included `deploy.yml`. If you see this error:

1. Go to **Settings → Actions → General → Workflow permissions**.
2. Select **"Read and write permissions"**.
3. Re-run the failed workflow.

### Netlify or Vercel shows a blank page

All CSS and JavaScript are inlined into each HTML file, so a blank page usually indicates the wrong folder was uploaded. Ensure you are deploying the **extracted** folder contents (where `index.html` is at the top level), not the ZIP file itself.

### Site content is outdated after re-exporting

Static hosts serve files from the last deploy. After re-exporting from SessionForge:

1. Extract the new ZIP, overwriting existing files.
2. Push to your repository (GitHub Pages / GitHub Actions) or re-run the deploy command (Netlify CLI / Vercel CLI / Wrangler).
3. Clear your browser cache or use an incognito window to verify the update.

---

For questions about the export format itself — themes, RSS feed, sitemap, and the API — see the [Static Site Export](./static-site-export.md) documentation.
