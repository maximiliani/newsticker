-- Create table for application-wide settings
CREATE TABLE public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings
CREATE POLICY "Allow public read access to app_settings"
    ON public.app_settings
    FOR SELECT
    TO public
    USING (true);

-- Allow only admins to update settings
CREATE POLICY "Allow admins to update app_settings"
    ON public.app_settings
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());

-- Insert default dashboard language
INSERT INTO public.app_settings (key, value)
VALUES ('dashboard_language', '"en"')
ON CONFLICT (key) DO NOTHING;
