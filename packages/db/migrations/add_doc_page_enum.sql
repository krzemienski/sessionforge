-- Migration: Add doc_page value to content_type enum
-- Date: 2026-03-21
-- Description: Adds 'doc_page' enum value to support documentation page repurposing format

ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'doc_page';

-- Verify the migration
SELECT enum_range(NULL::content_type);
