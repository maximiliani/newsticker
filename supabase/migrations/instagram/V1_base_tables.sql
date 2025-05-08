BEGIN;

-- Main table for storing Instagram account information
-- Links to Supabase auth users and stores encrypted tokens in vault
CREATE TABLE instagram_accounts (
   id BIGINT PRIMARY KEY,                             -- Instagram's internal account ID
   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to Supabase user
   username VARCHAR(255) NOT NULL,                    -- Instagram username
   profile_image_url TEXT,                           -- Profile picture URL
   access_token_secret_id UUID NOT NULL,             -- Reference to encrypted token in vault
   token_expires_at TIMESTAMP WITH TIME ZONE,        -- Token expiration timestamp
   timestamp BIGINT NOT NULL,                        -- Instagram's timestamp for the account
   created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Record creation time
   updated_at TIMESTAMP WITH TIME ZONE,              -- Record last update time
   CONSTRAINT username_unique UNIQUE (username),      -- Ensure global username uniqueness
   CONSTRAINT user_username_unique UNIQUE (user_id, username), -- Ensure per-user username uniqueness
   CONSTRAINT valid_profile_url CHECK (profile_image_url IS NULL OR profile_image_url ~ '^https?://.*$') -- Validate URL format
);

-- Table for storing Instagram posts metadata
CREATE TABLE instagram_posts (
   id BIGINT PRIMARY KEY,                            -- Instagram's internal post ID
   user_id BIGINT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE, -- Link to Instagram account
   caption TEXT CHECK (length(caption) <= 2200),     -- Post caption with Instagram's length limit
   posted_at TIMESTAMP WITH TIME ZONE NOT NULL,      -- When the post was published on Instagram
   location VARCHAR(255),                            -- Optional location tag for the post
   timestamp BIGINT NOT NULL,                        -- Instagram's timestamp for the post
   created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Record creation time
   updated_at TIMESTAMP WITH TIME ZONE               -- Record last update time
);

-- Table for storing media attachments for posts (images, videos)
CREATE TABLE instagram_post_media (
   post_id BIGINT NOT NULL REFERENCES instagram_posts(id) ON DELETE CASCADE, -- Link to parent post
   index INTEGER NOT NULL CHECK (index >= 0),        -- Position in carousel (0-based) or single media
   media_type media_type NOT NULL,                   -- Type of media (enum: image, video)
   media_url TEXT NOT NULL CHECK (media_url ~ '^https?://.*$'), -- URL to the media file
   thumbnail_url TEXT CHECK (thumbnail_url IS NULL OR thumbnail_url ~ '^https?://.*$'), -- Optional thumbnail for videos
   timestamp BIGINT NOT NULL,                        -- Instagram's timestamp for the media
   created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Record creation time
   updated_at TIMESTAMP WITH TIME ZONE,              -- Record last update time
   PRIMARY KEY (post_id, index)                      -- Composite key ensuring unique position per post
);
COMMIT;