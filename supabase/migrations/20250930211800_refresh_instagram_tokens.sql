BEGIN;

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
  v_body_text TEXT;
  v_body JSONB;
  v_new_token TEXT;
  v_refreshed INT := 0;
  v_failed INT := 0;
BEGIN
  FOR r_acc IN
    SELECT a.id, a.access_token_secret_id
    FROM instagram_accounts a
    WHERE CASE WHEN lower(p_scope) = 'all' THEN TRUE ELSE a.user_id = auth.uid() END
  LOOP
    -- Call IG refresh endpoint using existing proxy to ensure sanitization
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
        PERFORM vault.update_secret(
          secret_id := r_acc.access_token_secret_id,
          new_secret := v_new_token
        );
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

COMMIT;
