/**
 * Migration script: Add 'approved' to post_status enum and create approval_workflows table.
 * Run with: bun scripts/migrate-approval-workflows.ts
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { SQL } from "bun";

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

const db = new SQL(DATABASE_URL);

async function migrate() {
  console.log("Connecting to database...");

  // 1. Add 'approved' to post_status enum if not already present
  const existingValues = await db`
    SELECT unnest(enum_range(NULL::post_status))::text AS val
  `;
  const hasApproved = existingValues.some((r: any) => r.val === "approved");

  if (!hasApproved) {
    console.log("Adding 'approved' to post_status enum...");
    await db.unsafe(`ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'approved'`);
    console.log("  'approved' added to post_status");
  } else {
    console.log("  'approved' already exists in post_status");
  }

  // 2. Create approval_workflows table if not exists
  const existingTables = await db`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'approval_workflows'
  `;

  if (existingTables.length === 0) {
    console.log("Creating approval_workflows table...");
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS approval_workflows (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        enabled boolean DEFAULT false,
        required_approvers integer DEFAULT 1,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    console.log("  approval_workflows table created");
  } else {
    console.log("  approval_workflows table already exists");
  }

  // 3. Create indexes
  console.log("Creating indexes...");
  await db.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS approval_workflows_workspace_id_uidx
    ON approval_workflows(workspace_id)
  `);
  console.log("  Indexes created");

  // 4. Verify
  console.log("\nVerifying migration...");
  const verifyTable = await db`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'approval_workflows'
  `;
  const verifyEnum = await db`
    SELECT unnest(enum_range(NULL::post_status))::text AS val
  `;
  const verifyApproved = verifyEnum.some((r: any) => r.val === "approved");

  if (verifyTable.length > 0) {
    console.log("  approval_workflows table: VERIFIED");
  } else {
    console.error("  approval_workflows table: MISSING - migration failed!");
    process.exit(1);
  }

  if (verifyApproved) {
    console.log("  post_status 'approved' value: VERIFIED");
  } else {
    console.error("  post_status 'approved' value: MISSING - migration failed!");
    process.exit(1);
  }

  console.log("\nMigration complete - approval_workflows schema is live.");
  await db.close();
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
