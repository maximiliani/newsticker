-- Start a transaction block
BEGIN;

-- Revoke all permissions on all tables in the public schema from all users
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- Revoke all permissions on all functions in the public schema from all users
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Grant usage permission on the public schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant SELECT permission on all tables in the public schema to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant execution permission on specific function to service_role
GRANT EXECUTE ON FUNCTION get_decrypted_instagram_tokens() TO service_role;

-- Grant execution permission on specific function to authenticated users
GRANT EXECUTE ON FUNCTION insert_instagram_account(
    BIGINT, 
    UUID, 
    VARCHAR(255), 
    TEXT, 
    TEXT, 
    BIGINT
) TO authenticated;

-- Grant USAGE permission on the public schema to all users
GRANT USAGE ON SCHEMA public TO PUBLIC;
-- Grant SELECT permission on public_instagram_accounts in the public schema to all users
GRANT SELECT ON public_instagram_accounts TO PUBLIC;
-- Grant SELECT permission on instagram_posts in the public schema to all users
GRANT SELECT ON instagram_posts TO PUBLIC;
-- Grant SELECT permission on instagram_post_media in the public schema to all users
GRANT SELECT ON instagram_post_media TO PUBLIC;


-- Commit the transaction
COMMIT;