BEGIN;

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
      SELECT status, content_type, content
      INTO v_status, v_ct, v_body_text
      FROM extensions.http_get(v_url);
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

REVOKE ALL ON FUNCTION public.refresh_instagram_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_instagram_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_instagram_tokens() TO service_role;

-- Create a cron job to refresh Instagram tokens every 24 hours
SELECT cron.schedule(
  'Refresh Instagram Tokens every 24 hours',
  '0 0 * * *',
  'SELECT refresh_instagram_tokens();'
);

COMMIT;