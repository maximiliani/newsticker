BEGIN;

-- Vault-backed token functions depend on the vault schema and functions.
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

COMMIT;

