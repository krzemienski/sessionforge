# Tooling

Complete technology inventory for SessionForge.

| Concern | Tool | Version | Notes |
|---------|------|---------|-------|
| Runtime | Bun | 1.2.4 | Primary runtime and package manager |
| Runtime (fallback) | Node.js | 20+ | Used in Docker production stage |
| Package Manager | Bun workspaces | — | Monorepo workspace resolution |
| Build System | Turborepo | 2.x | Task graph orchestration |
| Framework | Next.js | 15.x | App Router, React Server Components |
| React | React | 19.x | — |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| UI Components | shadcn/ui | — | Radix-based component library |
| Editor | Lexical | 0.41.x | Rich text with markdown import/export |
| Server State | TanStack Query | 5.x | Data fetching and caching |
| Client State | Zustand | 5.x | Lightweight store |
| Database | PostgreSQL | 16 | Via Neon serverless |
| Database Driver | @neondatabase/serverless | 0.10.x | HTTP-based serverless driver |
| ORM | Drizzle ORM | 0.39.x | Type-safe SQL |
| Migrations | drizzle-kit | 0.31.x | Schema push and migration generation |
| Auth | Better Auth | 1.2.x | Email/password + OAuth |
| AI | @anthropic-ai/claude-agent-sdk | 0.2.x | CLI-inherited auth, zero API keys |
| Cache | Upstash Redis | 1.34.x | REST-based Redis |
| Queue | Upstash QStash | 2.7.x | HTTP-based job scheduling |
| Billing | Stripe | 17.x | Subscription and usage billing |
| Validation | Zod | 3.24.x | Runtime schema validation |
| Markdown Rendering | react-markdown + remark-gfm | 9.x / 4.x | GFM-compatible rendering |
| Syntax Highlighting | highlight.js + rehype-highlight | 11.x / 7.x | Code block highlighting |
| Diagrams | Mermaid | 11.4.x | Diagram generation |
| Charts | Recharts | 2.15.x | Data visualization |
| Git | simple-git | 3.32.x | Git operations from Node.js |
| Archive | JSZip | 3.10.x | Export packaging |
| Search | MiniSearch | 7.2.x | Client-side full-text search |
| HTTP Parsing | Cheerio | 1.2.x | HTML parsing for ingestion |
| Readability | @mozilla/readability | 0.6.x | Article extraction |
| Diff | diff | 7.x | Revision comparison |
| Icons | lucide-react | 0.576.x | Icon library |
| Panels | react-resizable-panels | 4.7.x | Split-pane editor layout |
| TypeScript | TypeScript | 5.7.x | — |
| Linting | ESLint | 8.x | With next config |
| Containerization | Docker | — | Multi-stage build with Bun + Node |
| Orchestration | Docker Compose | — | Local dev and production |
| CI/CD | GitHub Actions | — | Lint, type check, build, Docker |
| Primary Deployment | Vercel | — | Serverless (no AI features) |
| Self-hosted | Docker | — | Full features with Claude CLI |
