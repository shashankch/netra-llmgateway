-- Migration V4: Add resolved_provider to cache_entries for explicit provider tracking
ALTER TABLE cache_entries ADD COLUMN IF NOT EXISTS resolved_provider VARCHAR(64);
