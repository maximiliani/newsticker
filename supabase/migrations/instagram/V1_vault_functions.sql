BEGIN;

-- Function to insert a new Instagram account with encrypted access token
-- Parameters:
--   p_id: Instagram account ID
--   p_user_id: User identifier
--   p_username: Instagram username
--   p_profile_image_url: URL of the profile image
--   p_access_token: Instagram API access token (will be encrypted)
--   p_timestamp: Timestamp of the account creation/update
CREATE OR REPLACE FUNCTION insert_instagram_account(
    p_id BIGINT,
    p_user_id UUID,
    p_username VARCHAR(255),
    p_profile_image_url TEXT,
    p_access_token TEXT,
    p_timestamp BIGINT
) RETURNS instagram_accounts 
SECURITY DEFINER -- Function runs with definer's privileges
SET search_path = public -- Explicitly set schema search path for security
AS $$
DECLARE
    v_secret_id UUID;    -- Stores the ID of the encrypted secret
    v_result instagram_accounts;    -- Stores the result of the insertion
BEGIN
    -- Store the access token in the vault.secrets table and get its ID
    INSERT INTO vault.secrets (secret)
    VALUES (p_access_token)
    RETURNING id INTO v_secret_id;

    -- Insert the Instagram account details
    -- The access token is stored as a reference to the encrypted secret
    INSERT INTO instagram_accounts (
        id, user_id, username, profile_image_url, 
        access_token_secret_id, timestamp
    )
    VALUES (
        p_id, p_user_id, p_username, p_profile_image_url,
        v_secret_id, p_timestamp
    )
    RETURNING * INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to retrieve decrypted Instagram tokens
-- Returns a table with account information and decrypted access tokens
-- Can only be accessed with service_role privileges
CREATE OR REPLACE FUNCTION get_decrypted_instagram_tokens()
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    username VARCHAR,
    access_token TEXT
) 
SECURITY DEFINER -- Function runs with definer's privileges
STABLE -- Indicates function doesn't modify the database
SET search_path = public -- Explicitly set schema search path for security
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.user_id::UUID,
        a.username,
        s.secret as access_token
    FROM instagram_accounts a
    JOIN vault.decrypted_secrets s ON s.id = a.access_token_secret_id
    WHERE auth.role() = 'service_role'; -- Restricts access to service role only
END;
$$ LANGUAGE plpgsql;

COMMIT;