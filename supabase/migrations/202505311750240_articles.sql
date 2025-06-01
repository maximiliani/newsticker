BEGIN;

-- Section 0: Ensure 'articles' table exists
-- Create the table with a primary key if it doesn't exist.
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Section 1: Modify 'articles' table structure
-- Ensure all necessary columns exist, add user_id, and drop legacy author columns.
ALTER TABLE public.articles
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL,
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL,
    ADD COLUMN IF NOT EXISTS content TEXT NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS visibility_from TIMESTAMPTZ NOT NULL,
    ADD COLUMN IF NOT EXISTS visibility_to TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL,
    DROP COLUMN IF EXISTS author_name,
    DROP COLUMN IF EXISTS author_avatar;

-- Create a foreign key relationship between articles.user_id and auth.users.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.articles'::regclass
        AND conname = 'articles_user_id_fkey'
    ) THEN
        ALTER TABLE public.articles
        ADD CONSTRAINT articles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- Add an index on the user_id column for better query performance.
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON public.articles(user_id);

-- Section 2: Row Level Security for 'articles' table
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to articles that are within their visibility window.
DROP POLICY IF EXISTS "Allow public read access to visible articles" ON public.articles;
CREATE POLICY "Allow public read access to visible articles"
ON public.articles
FOR SELECT
USING (
    visibility_from <= timezone('utc'::text, now()) AND visibility_to >= timezone('utc'::text, now())
);

-- Policy: Allow authenticated users to insert articles, checking they are the author.
DROP POLICY IF EXISTS "Allow authenticated users to insert their own articles" ON public.articles;
CREATE POLICY "Allow authenticated users to insert their own articles"
ON public.articles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to update their own articles.
DROP POLICY IF EXISTS "Allow users to update their own articles" ON public.articles;
CREATE POLICY "Allow users to update their own articles"
ON public.articles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to delete their own articles.
DROP POLICY IF EXISTS "Allow users to delete their own articles" ON public.articles;
CREATE POLICY "Allow users to delete their own articles"
ON public.articles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Allow service_role full access (e.g., for admin operations from a backend).
DROP POLICY IF EXISTS "Allow service_role full access" ON public.articles;
CREATE POLICY "Allow service_role full access"
ON public.articles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Section 3: Create 'articles_with_author_info' view
-- This view combines articles with author information from auth.users.
CREATE OR REPLACE VIEW public.articles_with_author_info AS
SELECT
    a.id,
    a.user_id,
    a.title,
    a.description,
    a.content,
    a.created_at,
    a.modified_at,
    a.visibility_from,
    a.visibility_to,
    (u.raw_user_meta_data ->> 'full_name')::text AS author_name,
    (u.raw_user_meta_data ->> 'avatar_url')::text AS author_avatar
FROM
    public.articles a
LEFT JOIN
    auth.users u ON a.user_id = u.id;

-- Section 4: Permissions for 'articles_with_author_info' view
GRANT SELECT ON public.articles_with_author_info TO anon;
GRANT SELECT ON public.articles_with_author_info TO authenticated;

-- Set the owner of the view (important for RLS behavior in some cases).
ALTER VIEW public.articles_with_author_info OWNER TO postgres; -- Adjust 'postgres' if your admin role is different.

-- RLS for views is primarily enforced by the RLS policies on their underlying base tables.
-- The 'public.articles' table has RLS policies that will filter data accessed via this view.
-- Explicit RLS policies (using CREATE POLICY) are not applied directly to views in this manner.

COMMIT;