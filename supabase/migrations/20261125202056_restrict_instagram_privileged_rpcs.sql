-- Privileged routines must not be callable through the public Data API.
REVOKE EXECUTE ON FUNCTION public.delete_instagram_account_data(bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_decrypted_instagram_tokens(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.instagram_api_request(text, jsonb, bigint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_instagram_tokens() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_vault_secret(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_vault_secret(text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_instagram_account_data(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_decrypted_instagram_tokens(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.instagram_api_request(text, jsonb, bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_instagram_tokens() TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_vault_secret(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_vault_secret(text, text, text, uuid) TO service_role;

-- Only the signed-in owner can add an account. Service-role calls are trusted.
CREATE OR REPLACE FUNCTION public.insert_instagram_account(
  p_id bigint, p_user_id uuid, p_username character varying,
  p_profile_image_url text, p_access_token text, p_timestamp bigint
) RETURNS public.instagram_accounts
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_secret_id uuid;
  v_result public.instagram_accounts;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF p_id IS NULL OR p_user_id IS NULL OR p_username IS NULL OR p_access_token IS NULL THEN
    RAISE EXCEPTION 'Required parameters cannot be null';
  END IF;
  IF p_username !~ '^[A-Za-z0-9._]{1,30}$' THEN
    RAISE EXCEPTION 'Invalid Instagram username format';
  END IF;
  IF p_profile_image_url IS NOT NULL AND p_profile_image_url !~ '^https?://[^\s/$.?#].[^\s]*$' THEN
    RAISE EXCEPTION 'Invalid profile image URL format';
  END IF;
  IF EXISTS (SELECT 1 FROM public.instagram_accounts WHERE id = p_id) THEN
    RAISE EXCEPTION 'Instagram account with ID % already exists', p_id;
  END IF;
  SELECT vault.create_secret(p_access_token) INTO v_secret_id;
  INSERT INTO public.instagram_accounts (id, user_id, username, profile_image_url, access_token_secret_id, timestamp)
  VALUES (p_id, p_user_id, p_username, p_profile_image_url, v_secret_id, p_timestamp)
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.insert_instagram_account(bigint, uuid, character varying, text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_instagram_account(bigint, uuid, character varying, text, text, bigint) TO authenticated, service_role;

ALTER VIEW public.public_instagram_accounts SET (security_invoker = true);

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'sync_users_secure', 'update_modified_at_column', 'check_is_admin',
      'check_realtime_status', 'get_all_users', 'is_admin', 'is_article_visible',
      'make_first_user_admin', 'sync_user_roles', 'update_updated_at_column', 'urlencode'
    )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, extensions, pg_temp', f.signature);
  END LOOP;
END;
$$;