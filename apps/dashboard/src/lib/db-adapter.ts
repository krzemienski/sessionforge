import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import postgres from "postgres";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import * as schema from "@sessionforge/db";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://user:pass@localhost:5432/placeholder";

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
