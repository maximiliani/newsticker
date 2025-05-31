BEGIN;

-- Add columns for local media storage to instagram_post_media table
ALTER TABLE instagram_post_media 
ADD COLUMN IF NOT EXISTS local_media_url TEXT,
ADD COLUMN IF NOT EXISTS local_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS download_status TEXT DEFAULT 'pending' CHECK (download_status IN ('pending', 'downloading', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS download_error TEXT,
ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMPTZ;

-- Create storage bucket for Instagram media if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('instagram-media', 'instagram-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'])
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the bucket
DO $$
BEGIN
    -- Public read access policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Instagram media public read'
    ) THEN
        CREATE POLICY "Instagram media public read" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'instagram-media');
    END IF;

    -- Service role upload access policy  
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Instagram media service upload'
    ) THEN
        CREATE POLICY "Instagram media service upload" 
        ON storage.objects FOR INSERT 
        WITH CHECK (bucket_id = 'instagram-media' AND auth.role() = 'service_role');
    END IF;

    -- Service role update access policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Instagram media service update'
    ) THEN
        CREATE POLICY "Instagram media service update" 
        ON storage.objects FOR UPDATE 
        USING (bucket_id = 'instagram-media' AND auth.role() = 'service_role');
    END IF;
END $$;

-- Create index for faster queries on download status
CREATE INDEX IF NOT EXISTS idx_instagram_post_media_download_status 
ON instagram_post_media(download_status);

-- Create index for local media URLs
CREATE INDEX IF NOT EXISTS idx_instagram_post_media_local_urls 
ON instagram_post_media(local_media_url, local_thumbnail_url);

COMMIT;