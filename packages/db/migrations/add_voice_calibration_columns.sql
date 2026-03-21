-- Migration: Add voice calibration columns to writing_style_profiles table
-- Date: 2026-03-21
-- Subtask: subtask-1-1

-- Add custom instructions (free-form text for user to guide voice generation)
ALTER TABLE writing_style_profiles
  ADD COLUMN IF NOT EXISTS custom_instructions TEXT;

-- Add vocabulary fingerprint (characteristic phrases/words the author favors)
ALTER TABLE writing_style_profiles
  ADD COLUMN IF NOT EXISTS vocabulary_fingerprint JSONB;

-- Add anti-AI patterns (filler phrases to avoid for more authentic voice)
ALTER TABLE writing_style_profiles
  ADD COLUMN IF NOT EXISTS anti_ai_patterns JSONB;

-- Add flag indicating this profile was calibrated from writing samples
ALTER TABLE writing_style_profiles
  ADD COLUMN IF NOT EXISTS calibrated_from_samples BOOLEAN DEFAULT FALSE;

-- Add voice parameter overrides (0-10 scale, null = use AI-detected value)
ALTER TABLE writing_style_profiles
  ADD COLUMN IF NOT EXISTS formality_override REAL;

ALTER TABLE writing_style_profiles
  ADD COLUMN IF NOT EXISTS humor_override REAL;

ALTER TABLE writing_style_profiles
  ADD COLUMN IF NOT EXISTS technical_depth_override REAL;
