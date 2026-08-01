-- ============================================================
-- Widens the embedding column to 3072 dimensions to match the larger
-- embedding models. Same-day follow-up to the initial schema.
-- ============================================================

alter table public.embeddings
alter column embedding type vector(3072);
