-- Add Phase 7 columns for refusal auto-escalation tracking and two-tier cache identification
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS escalated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS cache_tier VARCHAR(32);
