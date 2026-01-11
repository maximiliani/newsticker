BEGIN;

-- Ensure http extension is available
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Helper function to URL-encode JSONB parameters
CREATE OR REPLACE FUNCTION urlencode(data jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text := '';
  key text;
  value text;
BEGIN
  FOR key, value IN SELECT * FROM jsonb_each_text(data)
  LOOP
    IF result <> '' THEN
      result := result || '&';
    END IF;
    result := result || key || '=' || extensions.urlencode(value);
  END LOOP;
  RETURN result;
END;
$$;

-- Migrate instagram_api_request to use http extension instead of pg_net
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
  v_resp extensions.http_response;
  v_status INT;
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
  v_resp := extensions.http_get(v_full_url);

  v_status := COALESCE(v_resp.status::int, 0);

  -- Try to parse body as JSON; fall back to text wrapper if not JSON
  BEGIN
    v_body_json := v_resp.content::jsonb;
  EXCEPTION WHEN others THEN
    v_body_json := jsonb_build_object('raw', COALESCE(v_resp.content, ''));
  END;

  -- Sanitize any sensitive values
  IF jsonb_typeof(v_body_json) = 'object' THEN
    v_body_json := v_body_json - 'access_token' - 'token' - 'authorization';
  END IF;

  -- Return sanitized URL without access token
  RETURN jsonb_build_object(
    'status', v_status,
    'body', v_body_json
  );
END;
$$;

REVOKE ALL ON FUNCTION instagram_api_request(TEXT, JSONB, BIGINT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION instagram_api_request(TEXT, JSONB, BIGINT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION instagram_api_request(TEXT, JSONB, BIGINT, UUID) TO service_role;

-- Migrate refresh_instagram_tokens to use http extension
CREATE OR REPLACE FUNCTION refresh_instagram_tokens()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r_acc RECORD;
  v_token TEXT;
  v_url TEXT;
  v_resp extensions.http_response;
  v_status INT;
  v_body JSONB;
  v_new_token TEXT;
  v_refreshed INT := 0;
  v_failed INT := 0;
BEGIN
  FOR r_acc IN
    SELECT id, access_token_secret_id
    FROM instagram_accounts
  LOOP
    v_token := NULL;
    v_url := NULL;

    IF r_acc.access_token_secret_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Read decrypted access token from Vault view
    BEGIN
      SELECT s.decrypted_secret
        INTO v_token
      FROM vault.decrypted_secrets s
      WHERE s.id = r_acc.access_token_secret_id
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END;

    IF v_token IS NULL THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    v_url := format(
      'https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=%s',
      v_token
    );

    BEGIN
      v_resp := extensions.http_get(v_url);
      v_status := COALESCE(v_resp.status::int, 0);

      -- Try to parse body as JSON
      BEGIN
        v_body := v_resp.content::jsonb;
      EXCEPTION WHEN OTHERS THEN
        v_body := '{}'::jsonb;
      END;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END;

    -- Success path: 2xx and access_token present
    IF v_status = 200 AND (v_body ? 'access_token') THEN
      v_new_token := v_body->>'access_token';

      BEGIN
        PERFORM vault.update_secret(
          secret_id := r_acc.access_token_secret_id,
          new_secret := v_new_token
        );
        v_refreshed := v_refreshed + 1;
      EXCEPTION WHEN OTHERS THEN
        v_failed := v_failed + 1;
      END;

    ELSE
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

  END LOOP;

  RETURN jsonb_build_object('refreshed', v_refreshed, 'failed', v_failed);
END;
$$;

COMMIT;
