-- NETRA LLM Gateway - Flyway Migration V2
-- Subsystem: Semantic Vector Storage
-- Adds HNSW cosine distance index for sub-5ms vector similarity search (<=>) on cache_entries

CREATE INDEX IF NOT EXISTS idx_cache_embedding_hnsw
ON cache_entries USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
