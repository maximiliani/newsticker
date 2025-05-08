-- Start a transaction block
BEGIN;

-- Create or replace a function that automatically updates the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the updated_at column to the current timestamp when a row is updated
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for instagram_accounts table
-- This trigger fires BEFORE any UPDATE operation on the table
CREATE TRIGGER update_instagram_accounts_updated_at
    BEFORE UPDATE ON instagram_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for instagram_posts table
-- This trigger fires BEFORE any UPDATE operation on the table
CREATE TRIGGER update_instagram_posts_updated_at
    BEFORE UPDATE ON instagram_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for instagram_post_media table
-- This trigger fires BEFORE any UPDATE operation on the table
CREATE TRIGGER update_instagram_post_media_updated_at
    BEFORE UPDATE ON instagram_post_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Commit the transaction
COMMIT;