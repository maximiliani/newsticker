-- Datetime of interest for an article (e.g. start of a calendar event).
ALTER TABLE public.articles
    ADD COLUMN IF NOT EXISTS event_datetime timestamptz,
    ADD COLUMN IF NOT EXISTS event_all_day boolean NOT NULL DEFAULT false;

UPDATE public.articles a
SET event_datetime = ce.event_start, event_all_day = ce.is_all_day
FROM public.calendar_events ce
WHERE ce.article_id = a.id AND a.event_datetime IS NULL;

CREATE INDEX IF NOT EXISTS articles_sort_at_idx
    ON public.articles ((COALESCE(event_datetime, created_at)) DESC, id DESC);

DROP VIEW IF EXISTS public.articles_with_author_info;
CREATE VIEW public.articles_with_author_info
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.user_id,
    a.title,
    a.description,
    a.created_at,
    a.modified_at,
    a.visibility_from,
    a.visibility_to,
    a.event_datetime,
    a.event_all_day,
    COALESCE(a.event_datetime, a.created_at) AS sort_at,
    COALESCE(a.custom_author_name, author_meta.name) AS author_name,
    author_meta.avatar_url AS author_avatar
FROM
    public.articles a
LEFT JOIN
    public.get_author_meta(a.user_id) AS author_meta ON true;

GRANT SELECT ON public.articles_with_author_info TO anon;
GRANT SELECT ON public.articles_with_author_info TO authenticated;
