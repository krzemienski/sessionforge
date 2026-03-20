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

  // 4. Create approval_decision_type enum
  console.log("Creating approval_decision_type enum...");
  await db.unsafe(`
    DO $$ BEGIN
      CREATE TYPE approval_decision_type AS ENUM ('approved', 'rejected', 'changes_requested');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  console.log("  approval_decision_type enum created");

  // 5. Create post_reviewers table
  const existingPostReviewers = await db`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_reviewers'
  `;

  if (existingPostReviewers.length === 0) {
    console.log("Creating post_reviewers table...");
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS post_reviewers (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by text REFERENCES users(id) ON DELETE SET NULL,
        assigned_at timestamp DEFAULT now()
      )
    `);
    console.log("  post_reviewers table created");
  } else {
    console.log("  post_reviewers table already exists");
  }

  // Create post_reviewers indexes
  console.log("Creating post_reviewers indexes...");
  await db.unsafe(`CREATE INDEX IF NOT EXISTS "postReviewers_postId_idx" ON post_reviewers(post_id)`);
  await db.unsafe(`CREATE INDEX IF NOT EXISTS "postReviewers_userId_idx" ON post_reviewers(user_id)`);
  await db.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "postReviewers_postId_userId_uidx" ON post_reviewers(post_id, user_id)`);
  console.log("  post_reviewers indexes created");

  // 6. Create approval_decisions table
  const existingApprovalDecisions = await db`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'approval_decisions'
  `;

  if (existingApprovalDecisions.length === 0) {
    console.log("Creating approval_decisions table...");
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS approval_decisions (
        id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
        post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        reviewer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        decision approval_decision_type NOT NULL,
        comment text,
        created_at timestamp DEFAULT now()
      )
    `);
    console.log("  approval_decisions table created");
  } else {
    console.log("  approval_decisions table already exists");
  }

  // Create approval_decisions indexes
  console.log("Creating approval_decisions indexes...");
  await db.unsafe(`CREATE INDEX IF NOT EXISTS "approvalDecisions_postId_idx" ON approval_decisions(post_id)`);
  await db.unsafe(`CREATE INDEX IF NOT EXISTS "approvalDecisions_reviewerId_idx" ON approval_decisions(reviewer_id)`);
  await db.unsafe(`CREATE INDEX IF NOT EXISTS "approvalDecisions_postId_createdAt_idx" ON approval_decisions(post_id, created_at)`);
  console.log("  approval_decisions indexes created");

  // 7. Verify
  console.log("\nVerifying migration...");
  const verifyTables = await db`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('approval_workflows', 'post_reviewers', 'approval_decisions')
  `;
  const verifyEnum = await db`
    SELECT unnest(enum_range(NULL::post_status))::text AS val
  `;
  const verifyApproved = verifyEnum.some((r: any) => r.val === "approved");

  const tableNames = new Set(verifyTables.map((r: any) => r.table_name));

  if (tableNames.has("approval_workflows")) {
    console.log("  approval_workflows table: VERIFIED");
  } else {
    console.error("  approval_workflows table: MISSING - migration failed!");
    process.exit(1);
  }

  if (tableNames.has("post_reviewers")) {
    console.log("  post_reviewers table: VERIFIED");
  } else {
    console.error("  post_reviewers table: MISSING - migration failed!");
    process.exit(1);
  }

  if (tableNames.has("approval_decisions")) {
    console.log("  approval_decisions table: VERIFIED");
  } else {
    console.error("  approval_decisions table: MISSING - migration failed!");
    process.exit(1);
  }

  if (verifyApproved) {
    console.log("  post_status 'approved' value: VERIFIED");
  } else {
    console.error("  post_status 'approved' value: MISSING - migration failed!");
    process.exit(1);
  }

  // Verify approval_decision_type enum
  try {
    const verifyDecisionEnum = await db.unsafe(
      `SELECT unnest(enum_range(NULL::approval_decision_type))::text AS val`
    );
    const decisionValues = verifyDecisionEnum.map((r: any) => r.val);
    if (decisionValues.includes("approved") && decisionValues.includes("rejected") && decisionValues.includes("changes_requested")) {
      console.log("  approval_decision_type enum: VERIFIED");
    } else {
      console.error("  approval_decision_type enum: INCOMPLETE - missing values!");
      process.exit(1);
    }
  } catch {
    console.error("  approval_decision_type enum: MISSING - migration failed!");
    process.exit(1);
  }

  console.log("\nMigration complete - all approval workflow tables and enums are live.");
  await db.close();
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
