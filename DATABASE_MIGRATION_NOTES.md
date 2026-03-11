# Database Migration - Version Label and Notes

## Status
Schema code changes are complete. Database push is blocked by connectivity issues.

## What Was Done
1. ✅ Schema updated in `packages/db/src/schema.ts` (subtask-1-1)
   - Added `versionLabel: text("version_label")`
   - Added `versionNotes: text("version_notes")`

2. ✅ SQL migration script created at `packages/db/migrations/add_version_label_and_notes.sql`

## Blocker
Database connection to Neon is failing with DNS resolution error:
```
Error: getaddrinfo ENOTFOUND ep-spring-moon-aiooih4n-pooler.c-4.us-east-1.aws.neon.tech
```

## Manual Migration Options

### Option 1: Run when database is accessible
```bash
cd packages/db && bun run db:push
```

### Option 2: Apply SQL directly
Connect to your PostgreSQL database and run:
```sql
ALTER TABLE post_revisions
ADD COLUMN IF NOT EXISTS version_label text,
ADD COLUMN IF NOT EXISTS version_notes text;
```

### Option 3: Use the generated SQL file
```bash
psql $DATABASE_URL -f packages/db/migrations/add_version_label_and_notes.sql
```

## Verification
After applying the migration, verify with:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'post_revisions'
AND column_name IN ('version_label', 'version_notes');
```

Expected result:
```
 column_name   | data_type | is_nullable
---------------+-----------+-------------
 version_label | text      | YES
 version_notes | text      | YES
```
