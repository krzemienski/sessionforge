# SessionForge Tooling Manifest

Canonical tools for every layer of the stack. All phases use only tools from this manifest.

| Concern | Tool | Version | Rationale |
|---------|------|---------|-----------|
| Runtime | Node.js | v22+ | Required by Next.js 15 |
| Package Manager | Bun | 1.2.4 | Monorepo workspaces, fast installs |
| Framework | Next.js (App Router) | 15.1 | Server components, API routes, middleware |
| UI Library | React | 19 | Latest with server components |
| Styling | Tailwind CSS | 3.x | Utility-first, shadcn/ui compatible |
| Component Library | shadcn/ui | latest | Accessible, composable components |
| Language | TypeScript | 5.7 | Strict mode, type safety |
| Database (production) | Neon Postgres | PG 17 (aws-us-east-2) | Project: sessionforge-prod, pooled connections |
| Database (local) | PostgreSQL via Docker | 16 | Dev parity with Neon |
| ORM | Drizzle ORM | latest | Type-safe, lightweight, push-based migrations |
| Auth | Better Auth | 1.2 | Email/password + OAuth providers |
| AI | @anthropic-ai/claude-agent-sdk | latest | CLI-inherited auth, no API keys |
| Rich Text Editor | Lexical | 0.41 | Extensible, React-native editor |
| Cache | Upstash Redis | — | Serverless Redis (placeholders in local dev) |
| Queue | Upstash QStash | — | Serverless job queue (placeholders in local dev) |
| Billing | Stripe | — | Checkout, subscriptions, webhooks |
| Containerization | Docker + Docker Compose | — | Cloud-agnostic portability |
| Deployment (primary) | Vercel | — | Primary hosting, preview deploys |
| Deployment (portable) | Any Docker host | — | Container agnosticism |
| CI/CD | GitHub Actions | — | Build, lint, container verification |
| Linting | ESLint + Next.js config | — | Framework-aware linting |
| Build | Turborepo | 2.x | Monorepo build orchestration |
| Test Runner | Vitest | 4.0 | Fast, Vite-compatible |
| Monorepo | Bun workspaces | — | apps/*, packages/* |
