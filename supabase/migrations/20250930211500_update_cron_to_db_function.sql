BEGIN;

-- Remove old cron job that called the Edge Function, if it exists
DO $$
DECLARE
  v_jobid INT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'Refresh Instagram Posts every 30 minutes' LIMIT 1;
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END$$;

-- Schedule new job to call the Postgres function directly every 30 minutes
SELECT cron.schedule(
  'Refresh Instagram Posts every 30 minutes',
  '*/30 * * * *',
  $$SELECT fetch_instagram_posts_and_store('all');$$
);

COMMIT;
