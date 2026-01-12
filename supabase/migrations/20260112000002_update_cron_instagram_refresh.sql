-- Start transaction
BEGIN;

-- Drop the old cron job if it exists
SELECT cron.unschedule('Refresh Instagram Posts every 30 minutes');

-- Create the new cron job using the Next.js API route
SELECT cron.schedule(
    'Refresh Instagram Posts every 30 minutes',
    '*/30 * * * *',
    $$
    WITH vars AS (
        SELECT
            nullif(current_setting('app.settings.CRON_APP_URL', true), '') AS app_url,
            nullif(current_setting('app.settings.CRON_INTERNAL_ADMIN_SECRET', true), '') AS internal_secret
    )
    SELECT net.http_post(
        url := rtrim(vars.app_url, '/') || '/api/features/instagram/refresh',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', vars.internal_secret
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
    )
    FROM vars
    WHERE vars.app_url IS NOT NULL AND vars.internal_secret IS NOT NULL;
    $$
);

COMMIT;
