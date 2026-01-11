BEGIN;

-- Function to clean up storage files when an Instagram account is deleted
CREATE OR REPLACE FUNCTION cleanup_instagram_account_storage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_files INT := 0;
BEGIN
  -- Delete all storage files for this account
  -- Storage paths follow pattern: {account_id}/{post_id}-{index}-{media|thumb}.{ext}
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'instagram-media'
      AND name LIKE OLD.id || '/%';

    GET DIAGNOSTICS v_deleted_files = ROW_COUNT;

    IF v_deleted_files > 0 THEN
      RAISE NOTICE 'Cleaned up % storage files for Instagram account %', v_deleted_files, OLD.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail the deletion
    RAISE WARNING 'Failed to delete storage files for account %: %', OLD.id, SQLERRM;
  END;

  RETURN OLD;
END;
$$;

-- Create trigger on instagram_accounts deletion
DROP TRIGGER IF EXISTS trigger_cleanup_instagram_account_storage ON instagram_accounts;

CREATE TRIGGER trigger_cleanup_instagram_account_storage
  BEFORE DELETE ON instagram_accounts
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_instagram_account_storage();

COMMENT ON TRIGGER trigger_cleanup_instagram_account_storage ON instagram_accounts IS
  'Automatically cleans up storage files when an Instagram account is deleted';

COMMIT;

