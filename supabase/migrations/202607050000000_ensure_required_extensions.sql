BEGIN;

-- Ensure all project-required extensions exist for both fresh installs and upgrades.
-- Keep this migration idempotent so repeated runs are safe.

-- UUID helper used by early schema migrations.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vault dependencies for encrypted secret storage.
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- HTTP stack used by Instagram RPCs and refresh flows.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

DO $do$
DECLARE
  v_http_schema text;
BEGIN
  SELECT n.nspname
	INTO v_http_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'http';

  IF v_http_schema IS NOT NULL AND v_http_schema <> 'extensions' THEN
	BEGIN
	  EXECUTE 'ALTER EXTENSION http SET SCHEMA extensions';
	  v_http_schema := 'extensions';
	EXCEPTION
	  WHEN OTHERS THEN
		RAISE NOTICE 'Could not move http extension from schema % to extensions: %', v_http_schema, SQLERRM;
	END;
  END IF;

  -- Backward-compatible shim if http remains in public and callers expect extensions.http_get(text).
  IF v_http_schema = 'public'
	 AND NOT EXISTS (
	   SELECT 1
	   FROM pg_proc p
	   JOIN pg_namespace n ON n.oid = p.pronamespace
	   WHERE n.nspname = 'extensions'
		 AND p.proname = 'http_get'
		 AND p.pronargs = 1
		 AND p.proargtypes[0] = 'text'::regtype
	 ) THEN
	EXECUTE $fn$
	  CREATE OR REPLACE FUNCTION extensions.http_get(uri text)
	  RETURNS public.http_response
	  LANGUAGE sql
	  STABLE
	  AS $$
		SELECT public.http_get(uri);
	  $$;
	$fn$;
  END IF;
END;
$do$;

-- Legacy network extension still referenced by older migration history.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Scheduler used by cron-driven refresh jobs.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION
  WHEN SQLSTATE '2BP01' THEN
	-- Supabase-managed pg_cron installs can already have dependent grants;
	-- skip hard failure on upgrade and keep migration idempotent.
	RAISE NOTICE 'Skipping pg_cron create due to existing dependent privileges (2BP01).';
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
	GRANT USAGE ON SCHEMA cron TO postgres;
	GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
  END IF;
END;
$$;

COMMIT;

