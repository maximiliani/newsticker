BEGIN;

-- ====================================
-- ENABLE REAL-TIME FOR ALL TABLES
-- ====================================

-- Enable real-time for articles table
ALTER TABLE public.articles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;

-- Enable real-time for instagram_posts table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instagram_posts') THEN
        ALTER TABLE public.instagram_posts REPLICA IDENTITY FULL;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_posts;
    END IF;
END $$;

-- Enable real-time for instagram_accounts table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instagram_accounts') THEN
        ALTER TABLE public.instagram_accounts REPLICA IDENTITY FULL;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_accounts;
    END IF;
END $$;

-- ====================================
-- GRANT PERMISSIONS FOR REAL-TIME
-- ====================================

-- Grant necessary permissions for real-time on articles
GRANT SELECT ON public.articles TO anon;
GRANT SELECT ON public.articles TO authenticated;

-- Grant permissions for Instagram tables (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instagram_posts') THEN
        GRANT SELECT ON public.instagram_posts TO anon;
        GRANT SELECT ON public.instagram_posts TO authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'instagram_accounts') THEN
        GRANT SELECT ON public.instagram_accounts TO anon;
        GRANT SELECT ON public.instagram_accounts TO authenticated;
    END IF;
END $$;

-- Ensure the real-time schema exists and has proper permissions
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;

-- ====================================
-- ENHANCED RLS POLICIES FOR REAL-TIME
-- ====================================

-- Update articles RLS policy to allow real-time subscriptions
-- This allows real-time to detect all changes, but we filter visibility in the app
DROP POLICY IF EXISTS "Allow public read access to visible articles" ON public.articles;
DROP POLICY IF EXISTS "Allow real-time subscription access" ON public.articles;

CREATE POLICY "Allow real-time subscription access"
ON public.articles
FOR SELECT
TO authenticated, anon
USING (true);

-- ====================================
-- HELPER FUNCTIONS
-- ====================================

-- Function to check if real-time is properly configured
CREATE OR REPLACE FUNCTION public.check_realtime_status()
RETURNS TABLE(
    table_name TEXT,
    replica_identity TEXT,
    in_publication BOOLEAN,
    table_exists BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH table_list AS (
        SELECT unnest(ARRAY['articles', 'instagram_posts', 'instagram_accounts']) as tname
    )
    SELECT 
        tl.tname::TEXT as table_name,
        CASE 
            WHEN c.relreplident = 'f' THEN 'FULL'
            WHEN c.relreplident = 'd' THEN 'DEFAULT'
            WHEN c.relreplident = 'n' THEN 'NOTHING'
            WHEN c.relreplident = 'i' THEN 'INDEX'
            ELSE 'NOT_SET'
        END::TEXT as replica_identity,
        COALESCE(EXISTS(
            SELECT 1 FROM pg_publication_tables pt 
            WHERE pt.pubname = 'supabase_realtime' 
            AND pt.tablename = tl.tname
            AND pt.schemaname = 'public'
        ), false) as in_publication,
        EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = tl.tname
        ) as table_exists
    FROM table_list tl
    LEFT JOIN pg_tables t ON t.tablename = tl.tname AND t.schemaname = 'public'
    LEFT JOIN pg_class c ON c.relname = tl.tname
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public';
END;
$$;

-- Function to check if an article is currently visible
CREATE OR REPLACE FUNCTION public.is_article_visible(article_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    article_record RECORD;
    now_timestamp TIMESTAMPTZ;
BEGIN
    now_timestamp := timezone('utc'::text, now());
    
    SELECT visibility_from, visibility_to
    INTO article_record
    FROM public.articles
    WHERE id = article_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    RETURN (
        article_record.visibility_from <= now_timestamp
        AND article_record.visibility_to >= now_timestamp
    );
END;
$$;

-- Create trigger function to automatically update modified_at timestamp
CREATE OR REPLACE FUNCTION public.update_modified_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to articles table
DROP TRIGGER IF EXISTS update_articles_modified_at ON public.articles;
CREATE TRIGGER update_articles_modified_at
    BEFORE UPDATE ON public.articles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_at_column();

-- ====================================
-- GRANT FUNCTION PERMISSIONS
-- ====================================

GRANT EXECUTE ON FUNCTION public.check_realtime_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_realtime_status() TO anon;
GRANT EXECUTE ON FUNCTION public.is_article_visible(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_article_visible(UUID) TO anon;

-- ====================================
-- VERIFICATION MESSAGE
-- ====================================

-- Add a comment to verify the migration completed
COMMENT ON FUNCTION public.check_realtime_status() IS 'Real-time configuration enabled for articles and Instagram tables - Migration 20250531180000';

COMMIT;