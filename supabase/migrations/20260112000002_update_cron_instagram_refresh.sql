-- Start transaction
BEGIN;

-- Drop the old cron job if it exists
SELECT cron.unschedule('Refresh Instagram Posts every 30 minutes');

-- Create the new cron job using the Next.js API route
SELECT cron.schedule(
    'Refresh Instagram Posts every 30 minutes',
    '*/30 * * * *', -- Every 30 minutes
    $$
    DECLARE
      v_app_url TEXT;
      v_internal_secret TEXT;
      v_endpoint_url TEXT;
      v_response_id BIGINT;
    BEGIN
      -- Fetch secrets from Vault
      SELECT decrypted_secret INTO v_app_url
      FROM vault.decrypted_secrets
      WHERE name = 'CRON_APP_URL';

      SELECT decrypted_secret INTO v_internal_secret
      FROM vault.decrypted_secrets
      WHERE name = 'CRON_INTERNAL_ADMIN_SECRET';

      -- Validate secrets exist
      IF v_app_url IS NULL THEN
        RAISE EXCEPTION 'Secret CRON_APP_URL not found in Vault.';
      END IF;
      IF v_internal_secret IS NULL THEN
        RAISE EXCEPTION 'Secret CRON_INTERNAL_ADMIN_SECRET not found in Vault.';
      END IF;

      -- Build endpoint URL
      v_endpoint_url := rtrim(v_app_url, '/') || '/api/features/instagram/refresh';

      -- Make HTTP POST request with internal secret for authentication
      SELECT net.http_post(
          url := v_endpoint_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-internal-secret', v_internal_secret
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 120000 -- 2 minutes timeout
      ) INTO v_response_id;

      -- Log success
      RAISE NOTICE 'Instagram refresh cron job executed successfully. Response ID: %', v_response_id;

    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but don't fail the cron job
        RAISE WARNING 'Instagram refresh cron job failed. URL: %, Error: %', v_endpoint_url, SQLERRM;
    END;
    $$
);

COMMIT;

