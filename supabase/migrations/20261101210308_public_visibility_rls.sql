-- =============================================================================
-- Public visibility model for articles + always-visible SneakPeek (events).
--
-- Requirements (per product owner):
--   1. Keep background/automatic updates working (Realtime must keep delivering
--      article change events to `anon` and `authenticated`).
--   2. The SneakPeek (upcoming events) is ALWAYS visible to logged-out users,
--      regardless of an article's visibility window.
--   3. The visibility window gates ONLY the ArticleFeed.
--   4. The article BODY (content / json_content / html_content) must NOT be
--      readable by logged-out (anon) users outside the visibility window —
--      served only through the visibility-enforcing RPC.
--
-- Design:
--   A. `articles` keeps unrestricted SELECT for anon/authenticated rows so
--      Realtime + feed titles + SneakPeek titles all keep working, but we
--      REVOKE anon column access to the body columns so the article body is
--      never exposed through the anonymous Supabase API.
--   B. `articles_with_author_info` is recreated WITHOUT body columns and WITH
--      (security_invoker = true); author name/avatar come from a restricted
--      SECURITY DEFINER helper so `auth.users` stays private.
--   C. `get_public_article_body(article_id)` RPC returns the body only when the
--      article is currently visible (or the caller is the owner/admin).
--   D. `anon` can read all calendar events (and subscription color) so the
--      SneakPeek always renders.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- A. Articles RLS + column-level body protection
-- ---------------------------------------------------------------------------

-- Drop any previous (visibility-scoped) SELECT policies.
DROP POLICY IF EXISTS "Allow public read access to visible articles" ON public.articles;
DROP POLICY IF EXISTS "Allow authenticated users to read own or visible articles" ON public.articles;
DROP POLICY IF EXISTS "Allow users to view all articles" ON public.articles;
DROP POLICY IF EXISTS "Allow real-time subscription access" ON public.articles;

-- Keep unrestricted row-level SELECT so Realtime continues to deliver change
-- events. The feed applies the visibility window in-app; the article body is
-- protected via column-level revocation below.
CREATE POLICY "Allow real-time subscription access"
  ON public.articles
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Do not expose the article BODY to anonymous users through the Data API.
REVOKE SELECT (content, json_content, html_content) ON public.articles FROM anon;

-- ---------------------------------------------------------------------------
-- B. Author metadata helper + public (body-less) view
-- ---------------------------------------------------------------------------

-- Return only the display name and avatar for a user, without exposing
-- auth.users (email, password hash, etc.) to anon/authenticated.
CREATE OR REPLACE FUNCTION public.get_author_meta(p_user_id uuid)
RETURNS TABLE(name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (u.raw_user_meta_data ->> 'full_name'),
    (u.raw_user_meta_data ->> 'avatar_url')
  FROM auth.users u
  WHERE u.id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_author_meta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_author_meta(uuid) TO anon, authenticated;

-- Public view: metadata only (no body), security-invoker so base-table RLS +
-- column privileges apply.
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
    COALESCE(a.custom_author_name, author_meta.name) AS author_name,
    author_meta.avatar_url AS author_avatar
FROM
    public.articles a
LEFT JOIN
    public.get_author_meta(a.user_id) AS author_meta ON true;

GRANT SELECT ON public.articles_with_author_info TO anon;
GRANT SELECT ON public.articles_with_author_info TO authenticated;

-- ---------------------------------------------------------------------------
-- C. Visibility-enforcing RPC for the article body
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_article_body(p_article_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_article    public.articles%ROWTYPE;
    v_now        timestamptz;
    v_is_visible boolean;
    v_is_owner   boolean;
BEGIN
    SELECT * INTO v_article FROM public.articles WHERE id = p_article_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_now        := timezone('utc'::text, now());
    v_is_visible := v_article.visibility_from <= v_now
                    AND (v_article.visibility_to IS NULL OR v_article.visibility_to >= v_now);
    v_is_owner   := (auth.uid() IS NOT NULL AND auth.uid() = v_article.user_id)
                    OR public.is_admin(auth.uid());

    IF v_is_owner OR v_is_visible THEN
        RETURN jsonb_build_object(
            'id',           v_article.id,
            'visible',      v_is_visible,
            'isOwner',      v_is_owner,
            'content',      v_article.content,
            'json_content', v_article.json_content,
            'html_content', v_article.html_content
        );
    ELSE
        RETURN jsonb_build_object('id', v_article.id, 'visible', false, 'isOwner', false);
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_article_body(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_article_body(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- D. Calendar RLS: anon can always read events + subscription color
-- ---------------------------------------------------------------------------

-- anon may view all calendar events (SneakPeek is always visible).
DROP POLICY IF EXISTS "Public can view events for visible articles" ON public.calendar_events;
DROP POLICY IF EXISTS "Public can view calendar events" ON public.calendar_events;
CREATE POLICY "Public can view calendar events"
  ON public.calendar_events
  FOR SELECT
  TO anon
  USING (true);

-- anon may read a subscription's color/name/id so the SneakPeek join works.
DROP POLICY IF EXISTS "Public can view subscription colors for visible events" ON public.calendar_subscriptions;
DROP POLICY IF EXISTS "Public can view calendar subscription metadata" ON public.calendar_subscriptions;
CREATE POLICY "Public can view calendar subscription metadata"
  ON public.calendar_subscriptions
  FOR SELECT
  TO anon
  USING (true);

-- Limit the subscription columns exposed to anon to just what SneakPeek needs.
REVOKE SELECT ON public.calendar_subscriptions FROM anon;
GRANT SELECT (id, name, color) ON public.calendar_subscriptions TO anon;

COMMIT;
