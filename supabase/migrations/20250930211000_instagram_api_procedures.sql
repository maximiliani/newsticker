BEGIN;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pgsodium; -- for vault

-- Proxy Instagram Graph API via Postgres with server-side token use
CREATE OR REPLACE FUNCTION instagram_api_request(
  p_route TEXT,
  p_params JSONB DEFAULT '{}'::jsonb,
  p_account_id BIGINT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token TEXT;
  v_url TEXT;
  v_resp JSONB;
  v_status INT;
  v_headers JSONB;
  v_body_text TEXT;
  v_body_json JSONB;
BEGIN
  IF p_route IS NULL OR length(trim(p_route)) = 0 THEN
    RAISE EXCEPTION 'instagram_api_request: route is required';
  END IF;

  -- Select the access token from Vault for either a specific account or the current user
  IF p_account_id IS NOT NULL THEN
    SELECT s.decrypted_secret
      INTO v_token
    FROM instagram_accounts a
    JOIN vault.decrypted_secrets s ON s.id = a.access_token_secret_id
    WHERE a.id = p_account_id
    LIMIT 1;
  ELSE
    SELECT s.decrypted_secret
      INTO v_token
    FROM instagram_accounts a
    JOIN vault.decrypted_secrets s ON s.id = a.access_token_secret_id
    WHERE a.user_id = COALESCE(p_user_id, auth.uid())
    ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
    LIMIT 1;
  END IF;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'instagram_api_request: no access token available for the requested scope';
  END IF;

  v_url := 'https://graph.instagram.com/' || regexp_replace(p_route, '^/+', '');

  v_resp := net.http_get(
    url := v_url,
    params := COALESCE(p_params, '{}'::jsonb) || jsonb_build_object('access_token', v_token),
    timeout_milliseconds := 20000
  );

  v_status := COALESCE((v_resp->>'status')::int, 0);
  v_headers := COALESCE(v_resp->'headers', '{}'::jsonb);
  v_body_text := COALESCE(v_resp->>'body', '');

  -- Try to parse body as JSON; fall back to text wrapper if not JSON
  BEGIN
    v_body_json := v_body_text::jsonb;
  EXCEPTION WHEN others THEN
    v_body_json := jsonb_build_object('raw', v_body_text);
  END;

  -- Sanitize any sensitive values
  IF jsonb_typeof(v_body_json) = 'object' THEN
    v_body_json := v_body_json - 'access_token' - 'token' - 'authorization';
  END IF;
  v_headers := v_headers - 'authorization' - 'Authorization';

  RETURN jsonb_build_object(
    'status', v_status,
    'headers', v_headers,
    'body', v_body_json
  );
END;
$$;

REVOKE ALL ON FUNCTION instagram_api_request(TEXT, JSONB, BIGINT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION instagram_api_request(TEXT, JSONB, BIGINT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION instagram_api_request(TEXT, JSONB, BIGINT, UUID) TO service_role;

-- Fetch recent media for accounts and store in tables. Keeps tokens server-side.
CREATE OR REPLACE FUNCTION fetch_instagram_posts_and_store(
  p_scope TEXT DEFAULT 'current' -- 'current' or 'all'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r_acc RECORD;
  v_params JSONB;
  v_resp JSONB;
  v_status INT;
  v_body JSONB;
  r_item JSONB;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_errors INT := 0;
BEGIN
  FOR r_acc IN
    SELECT id, user_id FROM instagram_accounts
    WHERE CASE WHEN lower(p_scope) = 'all' THEN TRUE ELSE user_id = auth.uid() END
  LOOP
    v_params := jsonb_build_object(
      'fields', 'id,caption,media_type,media_url,thumbnail_url,timestamp',
      'limit', 50
    );

    v_resp := instagram_api_request('me/media', v_params, r_acc.id, NULL);
    v_status := (v_resp->>'status')::int;
    IF v_status < 200 OR v_status >= 300 THEN
      v_errors := v_errors + 1;
      CONTINUE;
    END IF;

    v_body := COALESCE(v_resp->'body', '{}'::jsonb);

    IF jsonb_typeof(v_body->'data') = 'array' THEN
      FOR r_item IN SELECT jsonb_array_elements(v_body->'data') AS item LOOP
        -- Upsert post
        BEGIN
          INSERT INTO instagram_posts (id, user_id, caption, posted_at, timestamp)
          VALUES (
            (r_item->'item'->>'id')::bigint,
            r_acc.id,
            NULLIF(r_item->'item'->>'caption',''),
            (r_item->'item'->>'timestamp')::timestamptz,
            EXTRACT(EPOCH FROM (r_item->'item'->>'timestamp')::timestamptz)::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            caption = EXCLUDED.caption,
            posted_at = EXCLUDED.posted_at,
            updated_at = NOW(),
            timestamp = EXCLUDED.timestamp;

          IF FOUND THEN
            v_inserted := v_inserted + 1;
          ELSE
            v_updated := v_updated + 1;
          END IF;

          -- Upsert media for the post (single index 0)
          INSERT INTO instagram_post_media (post_id, index, media_type, media_url, thumbnail_url, timestamp)
          VALUES (
            (r_item->'item'->>'id')::bigint,
            0,
            CASE UPPER(r_item->'item'->>'media_type')
              WHEN 'VIDEO' THEN 'video'::media_type
              ELSE 'image'::media_type
            END,
            COALESCE(r_item->'item'->>'media_url', r_item->'item'->>'thumbnail_url'),
            NULLIF(r_item->'item'->>'thumbnail_url',''),
            EXTRACT(EPOCH FROM (r_item->'item'->>'timestamp')::timestamptz)::bigint
          )
          ON CONFLICT (post_id, index) DO UPDATE SET
            media_type = EXCLUDED.media_type,
            media_url = EXCLUDED.media_url,
            thumbnail_url = EXCLUDED.thumbnail_url,
            updated_at = NOW(),
            timestamp = EXCLUDED.timestamp;
        EXCEPTION WHEN others THEN
          v_errors := v_errors + 1;
          CONTINUE;
        END;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION fetch_instagram_posts_and_store(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fetch_instagram_posts_and_store(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_instagram_posts_and_store(TEXT) TO service_role;

COMMIT;
