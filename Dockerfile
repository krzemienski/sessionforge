# -- Stage 1: Install dependencies --
FROM oven/bun:1.2.4-slim AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/db/package.json ./packages/db/
COPY packages/tsconfig/package.json ./packages/tsconfig/

RUN bun install --frozen-lockfile

# -- Stage 2: Build the application --
FROM oven/bun:1.2.4-slim AS builder
WORKDIR /app

# Bun hoists all workspace deps to root node_modules
COPY --from=deps /app/node_modules ./node_modules

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/dashboard && bun run build

# -- Stage 3: Production runner --
# node:22-slim per D-03 (Node 22 LTS)
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Clear CLAUDECODE to prevent nested-session rejection bug per D-05
ENV CLAUDECODE=""

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/public ./apps/dashboard/public

# Copy migration files (not traced by Next.js standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/migrations ./packages/db/migrations

# Copy and set up entrypoint script per D-02
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/healthcheck').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Entrypoint runs migrations before CMD per D-02
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/dashboard/server.js"]
