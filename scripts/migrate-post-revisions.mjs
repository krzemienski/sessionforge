/**
 * Migration script: Create post_revisions table and required PostgreSQL enums.
 * Run with: node scripts/migrate-post-revisions.mjs
 */

import { neon } from "../apps/dashboard/node_modules/@neondatabase/serverless/index.mjs";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load DATABASE_URL from root .env
const envPath = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf8");
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbUrlMatch) {
  console.error("ERROR: DATABASE_URL not found in .env");
  process.exit(1);
}
const DATABASE_URL = dbUrlMatch[1].trim();

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("Connecting to database...");

  // 1. Check existing state
  const existingTables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_revisions'
  `;
  const existingEnums = await sql`
    SELECT typname FROM pg_type
    WHERE typname IN ('edit_type', 'version_type')
  `;

  console.log("Existing post_revisions table:", existingTables.length > 0 ? "EXISTS" : "ABSENT");
  console.log("Existing enums:", existingEnums.map(r => r.typname).join(", ") || "NONE");

  // 2. Create edit_type enum if not exists
  if (!existingEnums.find(r => r.typname === "edit_type")) {
    console.log("Creating edit_type enum...");
    await sql`
      CREATE TYPE edit_type AS ENUM ('user_edit', 'ai_generated', 'auto_save', 'restore')
    `;
    console.log("  ✓ edit_type created");
  } else {
    console.log("  ✓ edit_type already exists");
  }

  // 3. Create version_type enum if not exists
  if (!existingEnums.find(r => r.typname === "version_type")) {
    console.log("Creating version_type enum...");
    await sql`
      CREATE TYPE version_type AS ENUM ('major', 'minor')
    `;
    console.log("  ✓ version_type created");
  } else {
    console.log("  ✓ version_type already exists");
  }

  // 4. Create post_revisions table if not exists
  if (existingTables.length === 0) {
    console.log("Creating post_revisions table...");
    await sql`
      CREATE TABLE IF NOT EXISTS post_revisions (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        version_number integer NOT NULL,
        version_type version_type NOT NULL,
        edit_type edit_type NOT NULL,
        content_snapshot text,
        content_diff jsonb,
        parent_revision_id text,
        title text NOT NULL,
        word_count integer DEFAULT 0,
        word_count_delta integer DEFAULT 0,
        created_at timestamp DEFAULT now(),
        created_by text
      )
    `;
    console.log("  ✓ post_revisions table created");
  } else {
    console.log("  ✓ post_revisions table already exists");
  }

  // 5. Create indexes
  console.log("Creating indexes...");
  await sql`
    CREATE INDEX IF NOT EXISTS post_revisions_post_id_idx
    ON post_revisions(post_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS post_revisions_post_id_version_number_idx
    ON post_revisions(post_id, version_number)
  `;
  console.log("  ✓ Indexes created");

  // 6. Verify
  console.log("\nVerifying migration...");
  const verifyTable = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_revisions'
  `;
  const verifyEnums = await sql`
    SELECT typname FROM pg_type
    WHERE typname IN ('edit_type', 'version_type')
  `;

  if (verifyTable.length > 0) {
    console.log("  ✓ post_revisions table: VERIFIED");
  } else {
    console.error("  ✗ post_revisions table: MISSING - migration failed!");
    process.exit(1);
  }

  const foundEnums = verifyEnums.map(r => r.typname);
  if (foundEnums.includes("edit_type") && foundEnums.includes("version_type")) {
    console.log("  ✓ edit_type enum: VERIFIED");
    console.log("  ✓ version_type enum: VERIFIED");
  } else {
    console.error("  ✗ Enums missing:", foundEnums);
    process.exit(1);
  }

  console.log("\n✅ Migration complete — post_revisions schema is live.");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
