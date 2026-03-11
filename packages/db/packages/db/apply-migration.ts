#!/usr/bin/env bun
/**
 * Apply database migration for version_label and version_notes columns
 * Subtask: subtask-1-2
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";

const sql = neon(process.env.DATABASE_URL!);

async function applyMigration() {
  try {
    console.log("Connecting to database...");

    // Read the migration SQL file
    const migrationPath = join(import.meta.dir, "migrations", "add_version_metadata.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("Applying migration: add_version_metadata.sql");
    console.log(migrationSQL);

    // Execute the migration
    await sql(migrationSQL);

    console.log("✅ Migration applied successfully!");

    // Verify the columns were added
    console.log("\nVerifying columns...");
    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'postRevisions'
      AND column_name IN ('version_label', 'version_notes')
      ORDER BY column_name;
    `;

    if (result.length === 2) {
      console.log("✅ Columns verified:");
      result.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.error("❌ Verification failed: Expected 2 columns, found", result.length);
      process.exit(1);
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

applyMigration();
