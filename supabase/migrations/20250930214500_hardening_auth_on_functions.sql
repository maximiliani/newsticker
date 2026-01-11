BEGIN;
CREATE EXTENSION IF NOT EXISTS http;
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
  v_full_url TEXT;
  v_resp http_response;
  v_status INT;
  v_headers JSONB;
  v_body_text TEXT;
  v_body_json JSONB;
  v_is_admin BOOLEAN := FALSE;
  v_owner UUID;
BEGIN
  IF p_route IS NULL OR length(trim(p_route)) = 0 THEN
    RAISE EXCEPTION 'instagram_api_request: route is required';
  END IF;

  -- Determine admin status for caller
  BEGIN
    v_is_admin := COALESCE(check_is_admin(), FALSE);
  EXCEPTION WHEN others THEN
    v_is_admin := FALSE;
  END;

  -- If a specific account is requested, enforce that it belongs to caller unless admin
  IF p_account_id IS NOT NULL THEN
    SELECT a.user_id INTO v_owner FROM instagram_accounts a WHERE a.id = p_account_id;
    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'instagram_api_request: account % not found', p_account_id;
    END IF;
    IF (v_owner <> auth.uid()) AND (NOT v_is_admin) THEN
      RAISE EXCEPTION 'instagram_api_request: not permitted to use another user''s account';
    END IF;

    SELECT s.decrypted_secret INTO v_token
    FROM instagram_accounts a
    JOIN vault.decrypted_secrets s ON s.id = a.access_token_secret_id
    WHERE a.id = p_account_id
    LIMIT 1;
  ELSE
    -- Otherwise, pick an account for the current (or specified) user
    SELECT s.decrypted_secret INTO v_token
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

  -- Build query string for GET request
  v_full_url := v_url || '?' || urlencode(COALESCE(p_params, '{}'::jsonb) || jsonb_build_object('access_token', v_token));

  -- Use http_get from http extension (synchronous)
  v_resp := http_get(v_full_url);

  v_status := COALESCE(v_resp.status::int, 0);
  v_body_json := COALESCE(v_resp.content::json, '{}'::json);

  RETURN jsonb_build_object(
    'url', regexp_replace(v_full_url, urlencode(jsonb_build_object('access_token', v_token)), ''),
    'params', p_params,
    'status', v_status,
    'body', v_body_json
  );
END;
$$;

-- Restrict function execution to service_role only (not directly to end-users)
REVOKE ALL ON FUNCTION instagram_api_request(TEXT, JSONB, BIGINT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION instagram_api_request(TEXT, JSONB, BIGINT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION instagram_api_request(TEXT, JSONB, BIGINT, UUID) TO service_role;

-- Enforce admin-only for p_scope='all' in fetch_instagram_posts_and_store
CREATE OR REPLACE FUNCTION fetch_instagram_posts_and_store(
  p_scope TEXT DEFAULT 'current'
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
  v_scope TEXT := 'current';
BEGIN
  IF lower(COALESCE(p_scope,'current')) = 'all' AND COALESCE(check_is_admin(), false) THEN
    v_scope := 'all';
  ELSE
    v_scope := 'current';
  END IF;

  FOR r_acc IN
    SELECT id, user_id FROM instagram_accounts
    WHERE CASE WHEN v_scope = 'all' THEN TRUE ELSE user_id = auth.uid() END
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

          INSERT INTO instagram_post_media (post_id, index, media_type, media_url, thumbnail_url, timestamp)
          VALUES (
            (r_item->'item'->>'id')::bigint,
            0,
            CASE UPPER(r_item->'item'->>'media_type') WHEN 'VIDEO' THEN 'video'::media_type ELSE 'image'::media_type END,
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

  RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION fetch_instagram_posts_and_store(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fetch_instagram_posts_and_store(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_instagram_posts_and_store(TEXT) TO service_role;

-- Enforce admin-only for p_scope='all' in refresh_instagram_tokens
CREATE OR REPLACE FUNCTION refresh_instagram_tokens(
  p_scope TEXT DEFAULT 'all'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r_acc RECORD;
  v_resp JSONB;
  v_status INT;
  v_body JSONB;
  v_new_token TEXT;
  v_refreshed INT := 0;
  v_failed INT := 0;
  v_scope TEXT := 'current';
BEGIN
  IF lower(COALESCE(p_scope,'all')) = 'all' THEN
    IF NOT COALESCE(check_is_admin(), false) THEN
      v_scope := 'current';
    ELSE
      v_scope := 'all';
    END IF;
  ELSE
    v_scope := 'current';
  END IF;

  FOR r_acc IN
    SELECT a.id, a.access_token_secret_id
    FROM instagram_accounts a
    WHERE CASE WHEN v_scope = 'all' THEN TRUE ELSE a.user_id = auth.uid() END
  LOOP
    v_resp := instagram_api_request(
      'refresh_access_token',
      jsonb_build_object('grant_type','ig_refresh_token'),
      r_acc.id,
      NULL
    );

    v_status := COALESCE((v_resp->>'status')::int, 0);
    v_body := COALESCE(v_resp->'body','{}'::jsonb);

    IF v_status BETWEEN 200 AND 299 AND (v_body ? 'access_token') THEN
      v_new_token := v_body->>'access_token';
      BEGIN
        PERFORM vault.update_secret(secret_id := r_acc.access_token_secret_id, new_secret := v_new_token);
        v_refreshed := v_refreshed + 1;
      EXCEPTION WHEN others THEN
        v_failed := v_failed + 1;
      END;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('refreshed', v_refreshed, 'failed', v_failed);
END;
$$;

REVOKE ALL ON FUNCTION refresh_instagram_tokens(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_instagram_tokens(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_instagram_tokens(TEXT) TO service_role;

-- Harden insert_instagram_account: require p_user_id matches caller unless admin; set GRANTs
CREATE OR REPLACE FUNCTION insert_instagram_account(
    p_id BIGINT,
    p_user_id UUID,
    p_username VARCHAR(255),
    p_profile_image_url TEXT,
    p_access_token TEXT,
    p_timestamp BIGINT
) RETURNS instagram_accounts 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_secret_id UUID;
    v_result instagram_accounts;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    IF p_id IS NULL OR p_user_id IS NULL OR p_username IS NULL OR p_access_token IS NULL THEN
        RAISE EXCEPTION 'Required parameters cannot be null';
    END IF;

    -- Enforce caller ownership unless admin
    BEGIN
      v_is_admin := COALESCE(check_is_admin(), FALSE);
    EXCEPTION WHEN others THEN
      v_is_admin := FALSE;
    END;

    IF (p_user_id <> auth.uid()) AND (NOT v_is_admin) THEN
      RAISE EXCEPTION 'Not permitted to insert account for a different user';
    END IF;

    -- Validate username format (alphanumeric, dots, and underscores only)
    IF NOT p_username ~ '^[A-Za-z0-9._]{1,30}$' THEN
        RAISE EXCEPTION 'Invalid Instagram username format';
    END IF;

    -- Validate URL format if provided
    IF p_profile_image_url IS NOT NULL AND NOT p_profile_image_url ~ '^https?://[^\s/$.?#].[^\s]*$' THEN
        RAISE EXCEPTION 'Invalid profile image URL format';
    END IF;

    BEGIN
        IF EXISTS (SELECT 1 FROM instagram_accounts WHERE id = p_id) THEN
            RAISE EXCEPTION 'Instagram account with ID % already exists', p_id;
        END IF;

        select vault.create_secret(p_access_token) into v_secret_id;

        INSERT INTO instagram_accounts (
            id, user_id, username, profile_image_url, 
            access_token_secret_id, timestamp
        )
        VALUES (
            p_id, p_user_id, p_username, p_profile_image_url,
            v_secret_id, p_timestamp
        )
        RETURNING * INTO v_result;

    EXCEPTION
        WHEN others THEN
            IF v_secret_id IS NOT NULL THEN
                DELETE FROM vault.secrets WHERE id = v_secret_id;
            END IF;
            RAISE;
    END;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION insert_instagram_account(BIGINT, UUID, VARCHAR, TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_instagram_account(BIGINT, UUID, VARCHAR, TEXT, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_instagram_account(BIGINT, UUID, VARCHAR, TEXT, TEXT, BIGINT) TO service_role;

COMMIT;
