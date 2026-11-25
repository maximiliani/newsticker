ALTER TABLE public.calendar_events
    ADD COLUMN IF NOT EXISTS timezone TEXT,
    ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO public.app_settings (key, value)
VALUES ('default_timezone', '"Europe/Berlin"')
ON CONFLICT (key) DO NOTHING;
