REVOKE ALL ON TABLE public.app_settings FROM anon, authenticated;
GRANT SELECT ON TABLE public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.app_settings TO authenticated;
