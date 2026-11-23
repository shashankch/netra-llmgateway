-- Phase 8: Add provider-side prompt caching discount tracking column
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS cached_tokens INT NOT NULL DEFAULT 0;
