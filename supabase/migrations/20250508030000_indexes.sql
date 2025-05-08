-- Begin a transaction block to ensure all indexes are created atomically
BEGIN;

-- Create index on user_id column in instagram_accounts table
-- This enables faster lookups of accounts by user_id
CREATE INDEX idx_instagram_accounts_user_id ON instagram_accounts(user_id);

-- Create index on username column in instagram_accounts table
-- This enables faster lookups of accounts by username
CREATE INDEX idx_instagram_accounts_username ON instagram_accounts(username);

-- Create index on user_id column in instagram_posts table
-- This enables faster queries when fetching posts for a specific user
CREATE INDEX idx_instagram_posts_user_id ON instagram_posts(user_id);

-- Create index on timestamp column in instagram_posts table with descending order
-- This optimizes queries that sort posts by time, especially for recent posts
CREATE INDEX idx_instagram_posts_timestamp ON instagram_posts(timestamp DESC);

-- Create index on post_id column in instagram_post_media table
-- This enables faster lookups of media associated with specific posts
CREATE INDEX idx_instagram_post_media_post_id ON instagram_post_media(post_id);

-- Create index on timestamp column in instagram_post_media table with descending order
-- This optimizes queries that sort media by time, especially for recent media
CREATE INDEX idx_instagram_post_media_timestamp ON instagram_post_media(timestamp DESC);

-- Commit the transaction, applying all index creation operations
COMMIT;