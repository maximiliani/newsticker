BEGIN;

-- Fix ambiguous column reference in check_realtime_status function
CREATE OR REPLACE FUNCTION public.check_realtime_status()
RETURNS TABLE(
    table_name TEXT,
    replica_identity TEXT,
    in_publication BOOLEAN,
    table_exists BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH table_list AS (
        SELECT unnest(ARRAY['articles', 'instagram_posts', 'instagram_accounts']) as tname
    )
    SELECT
        tl.tname::TEXT as table_name,
        CASE
            WHEN c.relreplident = 'f' THEN 'FULL'
            WHEN c.relreplident = 'd' THEN 'DEFAULT'
            WHEN c.relreplident = 'n' THEN 'NOTHING'
            WHEN c.relreplident = 'i' THEN 'INDEX'
            ELSE 'NOT_SET'
        END::TEXT as replica_identity,
        COALESCE(EXISTS(
            SELECT 1 FROM pg_publication_tables pt
            WHERE pt.pubname = 'supabase_realtime'
            AND pt.tablename = tl.tname
            AND pt.schemaname = 'public'
        ), false) as in_publication,
        EXISTS(
            SELECT 1 FROM information_schema.tables ist
            WHERE ist.table_schema = 'public'
            AND ist.table_name = tl.tname
        ) as table_exists
    FROM table_list tl
    LEFT JOIN pg_tables t ON t.tablename = tl.tname AND t.schemaname = 'public'
    LEFT JOIN pg_class c ON c.relname = tl.tname
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public';
END;
$$;

-- Fix unused variables in instagram_api_request function
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

  -- Try to parse body as JSON; fall back to text wrapper if not JSON
  BEGIN
    v_body_json := (v_resp->>'body')::jsonb;
  EXCEPTION WHEN others THEN
    v_body_json := jsonb_build_object('raw', COALESCE(v_resp->>'body', ''));
  END;

  -- Sanitize any sensitive values
  IF jsonb_typeof(v_body_json) = 'object' THEN
    v_body_json := v_body_json - 'access_token' - 'token' - 'authorization';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'headers', COALESCE(v_resp->'headers', '{}'::jsonb) - 'authorization' - 'Authorization',
    'body', v_body_json
  );
END;
$$;

-- Fix non-existent http_get function in refresh_instagram_tokens
CREATE OR REPLACE FUNCTION refresh_instagram_tokens() RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r_acc RECORD;
  v_token TEXT;
  v_url TEXT;

  v_status INT;
  v_ct TEXT;
  v_body_text TEXT;
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
      DECLARE
        v_http_resp JSONB;
      BEGIN
        v_http_resp := net.http_get(v_url, timeout_milliseconds := 20000);
        v_status := COALESCE((v_http_resp->>'status')::int, 0);
        v_ct := COALESCE(v_http_resp->'headers'->>'content-type', '');
        v_body_text := COALESCE(v_http_resp->>'body', '');
      END;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END;

    -- Parse JSON body if JSON-like
    IF COALESCE(LOWER(v_ct), '') LIKE 'application/json%' OR COALESCE(LOWER(v_ct), '') LIKE 'text/json%' THEN
      BEGIN
        v_body := v_body_text::jsonb;
      EXCEPTION WHEN OTHERS THEN
        v_body := '{}'::jsonb;
      END;
    ELSE
      v_body := '{}'::jsonb;
    END IF;

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
