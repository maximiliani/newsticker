CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.instagram_refresh_lease (
  key boolean PRIMARY KEY DEFAULT true CHECK (key),
  owner uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
REVOKE ALL ON private.instagram_refresh_lease FROM PUBLIC, anon, authenticated;
ALTER TABLE private.instagram_refresh_lease ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_instagram_posts_feed_cursor
  ON public.instagram_posts ("timestamp" DESC, id DESC);

CREATE OR REPLACE FUNCTION public.acquire_instagram_refresh_lease(p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, private, pg_temp AS $$
DECLARE acquired uuid;
BEGIN
  IF p_owner IS NULL THEN RAISE EXCEPTION 'Lease owner is required'; END IF;
  INSERT INTO private.instagram_refresh_lease AS lease (key, owner, expires_at)
  VALUES (true, p_owner, now() + interval '10 minutes')
  ON CONFLICT (key) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at
  WHERE lease.expires_at < now()
  RETURNING owner INTO acquired;
  RETURN acquired = p_owner;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_instagram_refresh_lease(p_owner uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, private, pg_temp AS $$
  DELETE FROM private.instagram_refresh_lease WHERE owner = p_owner;
$$;
REVOKE ALL ON FUNCTION public.acquire_instagram_refresh_lease(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_instagram_refresh_lease(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_instagram_refresh_lease(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_instagram_refresh_lease(uuid) TO service_role;