-- Migration name: create_instagram_tables
-- Description: Creates tables for Instagram integration with vault-stored tokens, user ownership, and RLS

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- vault extension should already be enabled in Supabase

-- Create enum type for media types
CREATE TYPE media_type AS ENUM ('image', 'video');

-- Create instagram_accounts table with vault reference for access token
CREATE TABLE instagram_accounts (
    id BIGINT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    profile_image_url TEXT,
    access_token_secret_id UUID NOT NULL,  -- Reference to the vault secret
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    timestamp BIGINT NOT NULL,
    CONSTRAINT username_unique UNIQUE (username),
    CONSTRAINT user_username_unique UNIQUE (user_id, username)
);

-- Create secure view for accessing decrypted tokens
CREATE OR REPLACE VIEW instagram_accounts_decrypted AS
SELECT 
    a.id,
    a.user_id,
    a.username,
    a.profile_image_url,
    s.secret as access_token,
    a.created_at,
    a.updated_at,
    a.timestamp
FROM instagram_accounts a
JOIN vault.decrypted_secrets s ON s.id = a.access_token_secret_id
WHERE auth.role() = 'service_role';  -- Built-in access control through WHERE clause

-- Create instagram_posts table
CREATE TABLE instagram_posts (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    caption TEXT,
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create instagram_post_media table
CREATE TABLE instagram_post_media (
    post_id BIGINT NOT NULL REFERENCES instagram_posts(id) ON DELETE CASCADE,
    index INTEGER NOT NULL CHECK (index >= 0),
    media_type media_type NOT NULL,
    media_url TEXT NOT NULL CHECK (media_url ~ '^https?://.*$'),
    thumbnail_url TEXT CHECK (thumbnail_url IS NULL OR thumbnail_url ~ '^https?://.*$'),
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (post_id, index)
);

-- Helper functions for token management
CREATE OR REPLACE FUNCTION insert_instagram_account(
    p_id BIGINT,
    p_user_id UUID,
    p_username VARCHAR(255),
    p_profile_image_url TEXT,
    p_access_token TEXT,
    p_timestamp BIGINT
) RETURNS instagram_accounts AS $$
DECLARE
    v_secret_id UUID;
    v_result instagram_accounts;
BEGIN
    -- First, store the access token in the vault
    INSERT INTO vault.secrets (secret)
    VALUES (p_access_token)
    RETURNING id INTO v_secret_id;

    -- Then create the account record with the secret reference
    INSERT INTO instagram_accounts (
        id,
        user_id,
        username,
        profile_image_url,
        access_token_secret_id,
        timestamp
    )
    VALUES (
        p_id,
        p_user_id,
        p_username,
        p_profile_image_url,
        v_secret_id,
        p_timestamp
    )
    RETURNING * INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_instagram_account_token(
    p_id BIGINT,
    p_user_id UUID,
    p_access_token TEXT
) RETURNS instagram_accounts AS $$
DECLARE
    v_result instagram_accounts;
BEGIN
    -- Update the secret in the vault
    UPDATE vault.secrets 
    SET secret = p_access_token
    FROM instagram_accounts
    WHERE vault.secrets.id = instagram_accounts.access_token_secret_id
    AND instagram_accounts.id = p_id
    AND instagram_accounts.user_id = p_user_id;

    -- Update the updated_at timestamp
    UPDATE instagram_accounts
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = p_id AND user_id = p_user_id
    RETURNING * INTO v_result;
    
    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Account not found or not owned by user';
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes
CREATE INDEX idx_instagram_accounts_user_id ON instagram_accounts(user_id);
CREATE INDEX idx_instagram_accounts_username ON instagram_accounts(username);
CREATE INDEX idx_instagram_posts_user_id ON instagram_posts(user_id);
CREATE INDEX idx_instagram_posts_timestamp ON instagram_posts(timestamp DESC);
CREATE INDEX idx_instagram_post_media_post_id ON instagram_post_media(post_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_instagram_accounts_updated_at
    BEFORE UPDATE ON instagram_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instagram_posts_updated_at
    BEFORE UPDATE ON instagram_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instagram_post_media_updated_at
    BEFORE UPDATE ON instagram_post_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_post_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instagram_accounts
CREATE POLICY "Users can view their own accounts"
    ON instagram_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own accounts"
    ON instagram_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts"
    ON instagram_accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts"
    ON instagram_accounts FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for instagram_posts
CREATE POLICY "Users can view posts from their accounts"
    ON instagram_posts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM instagram_accounts
        WHERE instagram_accounts.id = instagram_posts.user_id
        AND instagram_accounts.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their own posts"
    ON instagram_posts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM instagram_accounts
        WHERE instagram_accounts.id = instagram_posts.user_id
        AND instagram_accounts.user_id = auth.uid()
    ));

-- RLS Policies for instagram_post_media
CREATE POLICY "Users can view media from their posts"
    ON instagram_post_media FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM instagram_posts
        JOIN instagram_accounts ON instagram_posts.user_id = instagram_accounts.id
        WHERE instagram_post_media.post_id = instagram_posts.id
        AND instagram_accounts.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage media from their posts"
    ON instagram_post_media FOR ALL
    USING (EXISTS (
        SELECT 1 FROM instagram_posts
        JOIN instagram_accounts ON instagram_posts.user_id = instagram_accounts.id
        WHERE instagram_post_media.post_id = instagram_posts.id
        AND instagram_accounts.user_id = auth.uid()
    ));

-- Comments
COMMENT ON TABLE instagram_accounts IS 'Stores Instagram account information with vault-stored access tokens';
COMMENT ON TABLE instagram_posts IS 'Stores Instagram posts with user ownership';
COMMENT ON TABLE instagram_post_media IS 'Stores media content for Instagram posts';
COMMENT ON VIEW instagram_accounts_decrypted IS 'Secure view for accessing Instagram access tokens from vault';

-- Down Migration
/*
DROP VIEW IF EXISTS instagram_accounts_decrypted;
DROP FUNCTION IF EXISTS update_instagram_account_token;
DROP FUNCTION IF EXISTS insert_instagram_account;
DROP TRIGGER IF EXISTS update_instagram_post_media_updated_at ON instagram_post_media;
DROP TRIGGER IF EXISTS update_instagram_posts_updated_at ON instagram_posts;
DROP TRIGGER IF EXISTS update_instagram_accounts_updated_at ON instagram_accounts;
DROP FUNCTION IF EXISTS update_updated_at_column;
DROP TABLE IF EXISTS instagram_post_media;
DROP TABLE IF EXISTS instagram_posts;
DROP TABLE IF EXISTS instagram_accounts;
DROP TYPE IF EXISTS media_type;
*/