BEGIN;

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
        INSERT INTO vault.secrets (secret)
        VALUES (p_access_token)
        RETURNING id INTO v_secret_id;

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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_decrypted_instagram_tokens(
    p_limit INTEGER DEFAULT 1000,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    username VARCHAR,
    access_token TEXT
) 
SECURITY DEFINER
STABLE 
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Validate parameters
    IF p_limit < 1 OR p_limit > 1000 THEN
        RAISE EXCEPTION 'Limit must be between 1 and 1000';
    END IF;
    IF p_offset < 0 THEN
        RAISE EXCEPTION 'Offset must be non-negative';
    END IF;

    -- Check both service_role and specific permission
    IF NOT (auth.role() = 'service_role')
    THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    RETURN QUERY
    SELECT 
        a.id,
        a.user_id::UUID,
        a.username,
        s.decrypted_secret as access_token
    FROM instagram_accounts a
    JOIN vault.decrypted_secrets s ON s.id = a.access_token_secret_id
    ORDER BY a.id
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

COMMIT;