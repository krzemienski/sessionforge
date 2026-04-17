import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import postgres from "postgres";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import * as schema from "@sessionforge/db";

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  // Fail fast in production unless explicitly opted out for build-time stubs.
  // SF_ALLOW_DB_PLACEHOLDER=1 lets CI build the app without a live DB URL —
  // the resulting bundle will still throw at first query if DATABASE_URL stays unset.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SF_ALLOW_DB_PLACEHOLDER !== "1"
  ) {
    throw new Error(
      "DATABASE_URL is required in production. Set DATABASE_URL or, for build-time only, SF_ALLOW_DB_PLACEHOLDER=1.",
    );
  }
  return "postgresql://user:pass@localhost:5432/placeholder";
}

const databaseUrl = resolveDatabaseUrl();

const databaseDriver = process.env.DATABASE_DRIVER;

/**
 * Returns true when the neon-http driver should be used.
 * Conditions:
 * - DATABASE_DRIVER=neon explicitly set, OR
 * - DATABASE_DRIVER is not set and URL contains neon.tech (auto-detect)
 * Falls back to postgres-js when DATABASE_DRIVER=postgres or URL is standard.
 */
function shouldUseNeon(): boolean {
  if (databaseDriver === "neon") return true;
  if (databaseDriver === "postgres") return false;
  return databaseUrl.includes("neon.tech");
}

function createDb(): NeonHttpDatabase<typeof schema> {
  if (shouldUseNeon()) {
    const sql = neon(databaseUrl);
    return neonDrizzle({ client: sql, schema });
  } else {
    const sql = postgres(databaseUrl);
    // Cast to NeonHttpDatabase for consistent typing — both drivers expose
    // the same query API when schema is provided.
    return pgDrizzle({ client: sql, schema }) as unknown as NeonHttpDatabase<typeof schema>;
  }
}

export const db = createDb();
