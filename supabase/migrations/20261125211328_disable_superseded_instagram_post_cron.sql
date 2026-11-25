DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id
  FROM cron.job
  WHERE jobname = 'Refresh Instagram Posts every 30 minutes';

  IF job_id IS NOT NULL THEN
    PERFORM cron.alter_job(job_id, active := false);
  END IF;
END;
$$;