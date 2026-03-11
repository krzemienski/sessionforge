-- Migration: Add version_label and version_notes to post_revisions table
-- Date: 2026-03-10
-- Description: Adds support for named versions and version notes

ALTER TABLE post_revisions
ADD COLUMN IF NOT EXISTS version_label text,
ADD COLUMN IF NOT EXISTS version_notes text;

-- Verify the migration
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'post_revisions'
AND column_name IN ('version_label', 'version_notes');
