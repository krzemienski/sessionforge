# Database Migration Notes

## Status
Schema code changes are complete. Database push is blocked by network allowlist restrictions on Neon.

## What Was Done
1. ✅ Schema updated in `packages/db/src/schema.ts` (subtask-1-1)
   - Added `versionLabel: text("version_label")`
   - Added `versionNotes: text("version_notes")`

2. ✅ SQL migration script created at `packages/db/migrations/add_version_label_and_notes.sql`

3. ✅ Schema updated in `packages/db/src/schema.ts` (subtask-1-1 of feature 040)
   - Added `"doc_page"` to `contentTypeEnum`

4. ✅ SQL migration script created at `packages/db/migrations/add_doc_page_enum.sql`

## Blocker
Database connection to Neon is failing. Two error modes have been observed:
- DNS resolution error: `getaddrinfo ENOTFOUND ep-spring-moon-aiooih4n-pooler.c-4.us-east-1.aws.neon.tech`
- Network allowlist block (HTTP 403): `Connection blocked by network allowlist`

The Neon project has an IP allowlist that prevents connections from the local dev environment.

## Manual Migration Options

### Migration 1: version_label and version_notes (post_revisions table)

#### Option 1: Run when database is accessible
```bash
cd packages/db && bun run db:push
```

#### Option 2: Apply SQL directly
Connect to your PostgreSQL database and run:
```sql
ALTER TABLE post_revisions
ADD COLUMN IF NOT EXISTS version_label text,
ADD COLUMN IF NOT EXISTS version_notes text;
```

#### Option 3: Use the generated SQL file
```bash
psql $DATABASE_URL -f packages/db/migrations/add_version_label_and_notes.sql
```

#### Verification
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

---

### Migration 2: doc_page enum value (content_type enum)

#### Apply SQL directly
```sql
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'doc_page';
```

#### Option: Use the generated SQL file
```bash
psql $DATABASE_URL -f packages/db/migrations/add_doc_page_enum.sql
```

#### Verification
```sql
SELECT enum_range(NULL::content_type);
```

Expected result: the array should include `'doc_page'` alongside existing values
(`blog_post`, `twitter_thread`, `linkedin_post`, `devto_post`, `changelog`, `newsletter`, `custom`, `doc_page`).
