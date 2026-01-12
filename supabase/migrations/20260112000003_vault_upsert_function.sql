-- Function to safely upsert secrets in Vault
CREATE OR REPLACE FUNCTION public.upsert_vault_secret(
    p_name TEXT,
    p_secret TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert or update the secret
    INSERT INTO vault.secrets (name, secret)
    VALUES (p_name, p_secret)
    ON CONFLICT (name)
    DO UPDATE SET secret = EXCLUDED.secret, updated_at = NOW();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_vault_secret(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.upsert_vault_secret(TEXT, TEXT) IS 
'Upserts secrets into Supabase Vault. Used to keep cron job secrets synchronized with application environment variables.';

