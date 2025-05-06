-- Migration name: create_instagram_tables_with_vault_and_user
-- Description: Creates tables for Instagram account, post, and media storage with encrypted access tokens and user ownership

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-v4";
-- pgsodium extension should already be enabled in Supabase by default

-- Create enum type for media types
CREATE TYPE media_type AS ENUM ('image', 'video');

-- Create IGAccount table with encrypted access token and user reference
CREATE TABLE ig_accounts (
    id BIGINT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    profile_picture_url TEXT NOT NULL,
    access_token_encrypted text NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, username)
);

-- Create secure view for accessing decrypted tokens
CREATE VIEW ig_accounts_decrypted AS
SELECT 
    id,
    user_id,
    username,
    profile_picture_url,
    pgsodium.decrypted_secret(access_token_encrypted) as access_token,
    created_at,
    updated_at
FROM ig_accounts;

-- Create IGPost table
CREATE TABLE ig_posts (
    id BIGINT PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
    caption TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create IGMedia table (unchanged)
CREATE TABLE ig_media (
    id BIGINT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    index INTEGER NOT NULL,
    media_type media_type NOT NULL,
    media_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post
        FOREIGN KEY (post_id)
        REFERENCES ig_posts(id)
        ON DELETE CASCADE
);

-- Update the insert function to include user_id
CREATE OR REPLACE FUNCTION insert_ig_account(
    p_id BIGINT,
    p_user_id UUID,
    p_username VARCHAR(255),
    p_profile_picture_url TEXT,
    p_access_token TEXT
) RETURNS ig_accounts AS $$
DECLARE
    v_result ig_accounts;
BEGIN
    INSERT INTO ig_accounts (
        id,
        user_id,
        username,
        profile_picture_url,
        access_token_encrypted
    )
    VALUES (
        p_id,
        p_user_id,
        p_username,
        p_profile_picture_url,
        pgsodium.encrypt_secret(p_access_token)
    )
    RETURNING * INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the token update function to check user ownership
CREATE OR REPLACE FUNCTION update_ig_account_token(
    p_id BIGINT,
    p_user_id UUID,
    p_access_token TEXT
) RETURNS ig_accounts AS $$
DECLARE
    v_result ig_accounts;
BEGIN
    UPDATE ig_accounts
    SET access_token_encrypted = pgsodium.encrypt_secret(p_access_token)
    WHERE id = p_id AND user_id = p_user_id
    RETURNING * INTO v_result;
    
    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Account not found or not owned by user';
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes
CREATE INDEX idx_ig_accounts_user_id ON ig_accounts(user_id);
CREATE INDEX idx_ig_accounts_username ON ig_accounts(username);
CREATE INDEX idx_ig_posts_account_id ON ig_posts(account_id);
CREATE INDEX idx_ig_posts_timestamp ON ig_posts(timestamp);
CREATE INDEX idx_ig_media_post_id ON ig_media(post_id);
CREATE INDEX idx_ig_media_index ON ig_media(index);

-- Timestamp trigger function (unchanged)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at (unchanged)
CREATE TRIGGER update_ig_accounts_updated_at
    BEFORE UPDATE ON ig_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ig_posts_updated_at
    BEFORE UPDATE ON ig_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ig_media_updated_at
    BEFORE UPDATE ON ig_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE ig_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ig_accounts
CREATE POLICY "Everyone can see all encrypted accounts"
    ON ig_accounts FOR SELECT
    USING (true);

CREATE POLICY "Users can create their own accounts"
    ON ig_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own accounts"
    ON ig_accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accounts"
    ON ig_accounts FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for ig_accounts_decrypted view
CREATE POLICY "Only the service_role can view the decrypted accounts"
    ON ig_accounts_decrypted FOR SELECT
    USING (auth.role() = 'service_role');

-- RLS Policies for ig_posts
CREATE POLICY "Everyone can see all posts"
    ON ig_posts FOR SELECT
    USING (true);

-- RLS Policies for ig_media
CREATE POLICY "Everyone can see all media"
    ON ig_media FOR SELECT
    USING (true);

-- Down Migration
-- DROP VIEW IF EXISTS ig_accounts_decrypted;
-- DROP FUNCTION IF EXISTS update_ig_account_token;
-- DROP FUNCTION IF EXISTS insert_ig_account;
-- DROP TRIGGER IF EXISTS update_ig_media_updated_at ON ig_media;
-- DROP TRIGGER IF EXISTS update_ig_posts_updated_at ON ig_posts;
-- DROP TRIGGER IF EXISTS update_ig_accounts_updated_at ON ig_accounts;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS ig_media;
-- DROP TABLE IF EXISTS ig_posts;
-- DROP TABLE IF EXISTS ig_accounts;
-- DROP TYPE IF EXISTS media_type;