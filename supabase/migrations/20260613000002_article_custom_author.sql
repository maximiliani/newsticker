ALTER TABLE articles ADD COLUMN IF NOT EXISTS custom_author_name TEXT DEFAULT NULL;

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
    COALESCE(a.custom_author_name, (u.raw_user_meta_data ->> 'full_name')::text) AS author_name,
    (u.raw_user_meta_data ->> 'avatar_url')::text AS author_avatar,
    a.media_urls,
    a.json_content,
    a.html_content
FROM
    public.articles a
LEFT JOIN
    auth.users u ON a.user_id = u.id;

GRANT SELECT ON public.articles_with_author_info TO anon;
GRANT SELECT ON public.articles_with_author_info TO authenticated;
