-- Migration: Add version_label and version_notes to postRevisions table
-- Date: 2026-03-10
-- Subtask: subtask-1-2

-- Add version_label column (nullable text)
ALTER TABLE "postRevisions"
ADD COLUMN IF NOT EXISTS "version_label" TEXT;

-- Add version_notes column (nullable text)
ALTER TABLE "postRevisions"
ADD COLUMN IF NOT EXISTS "version_notes" TEXT;
