-- Add coverImage and isPublic fields to collections table
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "cover_image" text;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false;

-- Add unique constraint on series_posts.post_id (a post can only be in one series)
CREATE UNIQUE INDEX IF NOT EXISTS "seriesPosts_postId_uidx" ON "series_posts" ("post_id");
