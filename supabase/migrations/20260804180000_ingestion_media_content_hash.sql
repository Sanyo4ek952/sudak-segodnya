-- Content hashes make server-side ingestion image replacement idempotent without
-- changing the existing private buckets or media ownership model.

alter table public.media_assets
  add column if not exists content_hash text;

alter table public.media_assets
  drop constraint if exists media_assets_content_hash_format,
  add constraint media_assets_content_hash_format check (
    content_hash is null or content_hash ~ '^[0-9a-f]{64}$'
  );

create index if not exists media_assets_content_hash_idx
  on public.media_assets(bucket_id, content_hash)
  where content_hash is not null and deleted_at is null;

notify pgrst, 'reload schema';
