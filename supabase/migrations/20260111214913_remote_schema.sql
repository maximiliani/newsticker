CREATE OR REPLACE FUNCTION public.insert_instagram_account(p_id bigint, p_user_id uuid, p_username character varying, p_profile_image_url text, p_access_token text, p_timestamp bigint)
 RETURNS public.instagram_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_secret_id UUID;
    v_result instagram_accounts;
BEGIN
    -- Input validation
    IF p_id IS NULL OR p_user_id IS NULL OR p_username IS NULL OR p_access_token IS NULL THEN
        RAISE EXCEPTION 'Required parameters cannot be null';
    END IF;

    -- Validate username format (alphanumeric, dots, and underscores only)
    IF NOT p_username ~ '^[A-Za-z0-9._]{1,30}$' THEN
        RAISE EXCEPTION 'Invalid Instagram username format';
    END IF;

    -- Validate URL format if provided
    IF p_profile_image_url IS NOT NULL AND NOT p_profile_image_url ~ '^https?://[^\s/$.?#].[^\s]*$' THEN
        RAISE EXCEPTION 'Invalid profile image URL format';
    END IF;

    -- Transaction for atomicity
    BEGIN
        -- Check for duplicate account
        IF EXISTS (SELECT 1 FROM instagram_accounts WHERE id = p_id) THEN
            RAISE EXCEPTION 'Instagram account with ID % already exists', p_id;
        END IF;

        -- Store the access token
        -- INSERT INTO vault.secrets (secret)
        -- VALUES (p_access_token)
        -- RETURNING id INTO v_secret_id;
        select vault.create_secret(p_access_token) into v_secret_id;

        -- Insert account details
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
            -- Cleanup on failure
            IF v_secret_id IS NOT NULL THEN
                DELETE FROM vault.secrets WHERE id = v_secret_id;
            END IF;
            RAISE;
    END;

    RETURN v_result;
END;
$function$
;


