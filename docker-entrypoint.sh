#!/bin/sh
set -e

echo "[docker-entrypoint] Running database migrations..."
# Use node directly -- no bun/ts-node in runner image.
# postgres and drizzle-orm are available in standalone node_modules.
node -e "
const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);
migrate(db, { migrationsFolder: '/app/packages/db/migrations' })
  .then(() => { console.log('[docker-entrypoint] Migrations applied successfully'); return sql.end(); })
  .catch((err) => { console.error('[docker-entrypoint] Migration failed:', err); process.exit(1); });
"

echo "[docker-entrypoint] Starting application..."
exec "$@"
