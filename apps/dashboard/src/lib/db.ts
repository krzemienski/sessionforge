import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@sessionforge/db";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://user:pass@localhost:5432/placeholder";

const sql = neon(databaseUrl);
export const db = drizzle({ client: sql, schema });
