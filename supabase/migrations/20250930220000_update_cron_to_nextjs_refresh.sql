BEGIN;

-- Unschedule existing job if present
DO $$
DECLARE
  v_jobid INT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'Refresh Instagram Posts every 30 minutes' LIMIT 1;
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END$$;

-- Schedule new job to call Next.js API route for media refresh (clones media into Storage)
SELECT cron.schedule(
  'Refresh Instagram Posts every 30 minutes',
  '*/30 * * * *',
  $$
  DECLARE
    v_app_url TEXT;
    v_internal_secret TEXT;
    v_target_url TEXT;
    v_resp JSONB;
  BEGIN
    -- Expect these to be present in Vault
    SELECT decrypted_secret INTO v_app_url FROM vault.decrypted_secrets WHERE name = 'CRON_APP_BASE_URL';
    SELECT decrypted_secret INTO v_internal_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_ADMIN_SECRET';

    IF v_app_url IS NULL THEN
      RAISE EXCEPTION 'Secret CRON_APP_BASE_URL not found in Vault.';
    END IF;
    IF v_internal_secret IS NULL THEN
      RAISE EXCEPTION 'Secret INTERNAL_ADMIN_SECRET not found in Vault.';
    END IF;

    v_target_url := rtrim(v_app_url, '/') || '/api/features/instagram/refresh';

    v_resp := net.http_post(
      url := v_target_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', v_internal_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );

    IF COALESCE((v_resp->>'status')::int,0) NOT BETWEEN 200 AND 299 THEN
      RAISE WARNING 'Cron call to % failed with status %, body: %', v_target_url, v_resp->>'status', v_resp->>'body';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pg_cron job failed. URL: %, Error: %', v_target_url, SQLERRM;
  END;
  $$
);

COMMIT;
