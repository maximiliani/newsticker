BEGIN;
-- Add json_content column to articles table
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS json_content JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS html_content TEXT DEFAULT NULL;

-- Update the articles_with_author_info view to include json_content
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
    (u.raw_user_meta_data ->> 'avatar_url')::text AS author_avatar,
    a.media_urls,
    a.json_content,
    a.html_content
FROM
    public.articles a
LEFT JOIN
    auth.users u ON a.user_id = u.id;

-- Grant permissions on the updated view
GRANT SELECT ON public.articles_with_author_info TO anon;
GRANT SELECT ON public.articles_with_author_info TO authenticated;

COMMIT;