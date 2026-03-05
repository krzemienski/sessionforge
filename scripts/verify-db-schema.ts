import { SQL } from "bun";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "../.env"), "utf8");
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbUrlMatch![1].trim().replace("&channel_binding=require", "");

const db = new SQL(DATABASE_URL);

const tables = await db`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'post_revisions'
`;

const enums = await db`
  SELECT typname FROM pg_type
  WHERE typname IN ('edit_type', 'version_type')
`;

const cols = await db`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'post_revisions'
  ORDER BY ordinal_position
`;

const indexes = await db`
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'post_revisions'
`;

console.log("=== Database Verification ===");
console.log("post_revisions table:", tables.length > 0 ? "EXISTS" : "MISSING");
console.log("Enums:", enums.map((r: any) => r.typname).join(", ") || "NONE");
console.log("Columns:", cols.map((r: any) => r.column_name).join(", "));
console.log("Indexes:", indexes.map((r: any) => r.indexname).join(", "));

await db.close();
