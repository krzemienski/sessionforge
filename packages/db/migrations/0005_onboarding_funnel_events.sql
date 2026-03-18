-- Migration: Add onboarding_funnel_events table
-- Task: 018-interactive-onboarding-guided-setup-wizard
-- Subtask: subtask-4-1

CREATE TABLE IF NOT EXISTS "onboarding_funnel_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "step" text NOT NULL,
  "event" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "onboarding_funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "onboardingFunnelEvents_userId_idx" ON "onboarding_funnel_events" ("user_id");
CREATE INDEX IF NOT EXISTS "onboardingFunnelEvents_createdAt_idx" ON "onboarding_funnel_events" ("created_at");
CREATE INDEX IF NOT EXISTS "onboardingFunnelEvents_step_idx" ON "onboarding_funnel_events" ("step");
