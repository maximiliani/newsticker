-- Start a transaction block
BEGIN;

-- 1. Create schema and extensions.
create extension IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT usage ON SCHEMA cron TO postgres;
GRANT all privileges ON all tables IN SCHEMA cron TO postgres;
CREATE EXTENSION IF NOT EXISTS pgsodium; -- Required for Supabase Vault access
CREATE EXTENSION IF NOT EXISTS pg_net; -- Required for net.http_post

-- 2. Create the cron job to refresh Instagram posts every 30 minutes.
SELECT
  cron.schedule(
    'Refresh Instagram Posts every 30 minutes', -- Job name
    '*/30 * * * *', -- Schedule interval (corrected from '30 minutes' if you intended standard cron syntax)
    $$
    DECLARE
      v_project_url TEXT;
--       v_service_key TEXT;
      v_function_target_url TEXT;
    BEGIN
      SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'CRON_SUPABASE_PROJECT_URL';
--       SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'CRON_SUPABASE_SERVICE_KEY';
--
--       IF v_project_url IS NULL THEN
--         RAISE EXCEPTION 'Secret CRON_SUPABASE_PROJECT_URL not found in Vault.';
--       END IF;
--       IF v_service_key IS NULL THEN
--         RAISE EXCEPTION 'Secret CRON_SUPABASE_SERVICE_KEY not found in Vault.';
--       END IF; TODO

      v_function_target_url := rtrim(v_project_url, '/') || '/functions/v1/fetchInstagramPostsAndStore';

      PERFORM net.http_post(
          url := v_function_target_url,
          headers := jsonb_build_object(
--             'apikey', v_service_key,
--             'Authorization', 'Bearer ' || v_service_key,
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 30000
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'pg_cron job "Refresh Instagram Posts every 30 minutes" failed. URL: %, Error: %', v_function_target_url, SQLERRM;
        RAISE;
    END;
    $$
  );

COMMIT;