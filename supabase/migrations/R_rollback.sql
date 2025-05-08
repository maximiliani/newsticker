BEGIN;

-- Drop view that contains decrypted Instagram account information
DROP VIEW IF EXISTS instagram_accounts_decrypted CASCADE;

-- Drop functions related to Instagram account management
DROP FUNCTION IF EXISTS update_instagram_account_token CASCADE;
DROP FUNCTION IF EXISTS insert_instagram_account CASCADE;
DROP FUNCTION IF EXISTS get_decrypted_instagram_tokens CASCADE;

-- Drop triggers that update timestamp columns
DROP TRIGGER IF EXISTS update_instagram_post_media_updated_at ON instagram_post_media;
DROP TRIGGER IF EXISTS update_instagram_posts_updated_at ON instagram_posts;
DROP TRIGGER IF EXISTS update_instagram_accounts_updated_at ON instagram_accounts;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Drop tables storing Instagram data in reverse order of dependencies
DROP TABLE IF EXISTS instagram_post_media CASCADE;  -- Media associated with posts
DROP TABLE IF EXISTS instagram_posts CASCADE;       -- Instagram posts
DROP TABLE IF EXISTS instagram_accounts CASCADE;    -- Instagram account information

-- Drop custom type definition
DROP TYPE IF EXISTS media_type CASCADE;

-- Commit the transaction
COMMIT;