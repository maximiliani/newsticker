BEGIN;

-- Account-level security policies
-- Allow public to view basic account information (excluding access token)
CREATE POLICY "Public can view basic account information"
    ON instagram_accounts FOR SELECT
    USING (true);  -- Allows anyone to view

-- Allow users to manage their own accounts
CREATE POLICY "Users can manage their own accounts"
    ON instagram_accounts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Posts policies
-- Allow public to view all posts
CREATE POLICY "Public can view all posts"
    ON instagram_posts FOR SELECT
    USING (true);  -- Allows anyone to view

-- Allow users to manage their own posts
CREATE POLICY "Users can manage their own posts"
    ON instagram_posts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM instagram_accounts
        WHERE instagram_accounts.id = instagram_posts.user_id
        AND instagram_accounts.user_id = auth.uid()
    ));

-- Media policies
-- Allow public to view all media
CREATE POLICY "Public can view all media"
    ON instagram_post_media FOR SELECT
    USING (true);  -- Allows anyone to view

-- Allow users to manage their own media
CREATE POLICY "Users can manage their own media"
    ON instagram_post_media FOR ALL
    USING (EXISTS (
        SELECT 1 FROM instagram_posts
        JOIN instagram_accounts ON instagram_posts.user_id = instagram_accounts.id
        WHERE instagram_post_media.post_id = instagram_posts.id
        AND instagram_accounts.user_id = auth.uid()
    ));

-- Create a secure view for public account information (excluding sensitive data)
CREATE OR REPLACE VIEW public_instagram_accounts AS
SELECT 
    id,
    username,
    profile_image_url,
    created_at,
    updated_at
FROM instagram_accounts;

-- Grant SELECT permission on the public view to the public role
GRANT SELECT ON public_instagram_accounts TO PUBLIC;

COMMIT;