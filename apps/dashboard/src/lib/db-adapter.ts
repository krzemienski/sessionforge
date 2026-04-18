import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import postgres from "postgres";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import * as schema from "@sessionforge/db";

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
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

function shouldUseNeon(): boolean {
  if (databaseDriver === "neon") return true;
  if (databaseDriver === "postgres") return false;
  return databaseUrl.includes("neon.tech");
}

/**
 * H5 note: callers type against `NeonHttpDatabase` throughout the codebase, so
 * the postgres-js driver is laundered to the same type. Both drivers share the
 * Drizzle query API (`query`, `select`, `insert`, `update`, `delete`,
 * `execute`) when constructed with `schema`, but their `.returning(cols)`
 * generic signatures diverge — the cast keeps the 15 `.returning({cols})` call
 * sites type-checking. Methods that truly diverge (e.g. `.transaction()`) are
 * not used anywhere in the app today; if added, the cast must be replaced with
 * a narrow union type and the offending code audited per driver. Attempted a
 * full union-type fix during H5 remediation but it surfaced 15 breakages; left
 * as known tech debt to resolve during the next Drizzle bump.
 */
function createDb(): NeonHttpDatabase<typeof schema> {
  if (shouldUseNeon()) {
    const sql = neon(databaseUrl);
    return neonDrizzle({ client: sql, schema });
  }
  const sql = postgres(databaseUrl);
  return pgDrizzle({ client: sql, schema }) as unknown as NeonHttpDatabase<typeof schema>;
}

export const db = createDb();
