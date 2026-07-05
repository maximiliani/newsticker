-- Start transaction
BEGIN;

-- Schedule the job to sync all calendars every 5 minutes
-- cron.schedule will update the job if it already exists with the same name.

SELECT cron.schedule(
    'Sync all calendars every 5 minutes',
    '*/5 * * * *',
    $$
    WITH vars AS (
        SELECT
            COALESCE(
                (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_APP_BASE_URL' LIMIT 1),
                nullif(current_setting('app.settings.CRON_APP_URL', true), '')
            ) AS app_url,
            COALESCE(
                (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_ADMIN_SECRET' LIMIT 1),
                nullif(current_setting('app.settings.CRON_INTERNAL_ADMIN_SECRET', true), '')
            ) AS internal_secret
    )
    SELECT net.http_post(
        url := rtrim(vars.app_url, '/') || '/api/features/calendar/sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', vars.internal_secret
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
    )
    FROM vars
    WHERE vars.app_url IS NOT NULL;
    $$
);

COMMIT;
