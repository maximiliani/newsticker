BEGIN;

-- Function to delete an Instagram account and all associated data and storage files
CREATE OR REPLACE FUNCTION delete_instagram_account_data(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account_exists BOOLEAN;
  v_post_ids BIGINT[];
  v_storage_files TEXT[];
  v_deleted_posts INT := 0;
  v_deleted_media INT := 0;
  v_deleted_files INT := 0;
BEGIN
  -- Check if account exists
  SELECT EXISTS(SELECT 1 FROM instagram_accounts WHERE id = p_id)
  INTO v_account_exists;

  IF NOT v_account_exists THEN
    RAISE EXCEPTION 'Instagram account % not found', p_id;
  END IF;

  -- Get all post IDs for this account
  SELECT ARRAY_AGG(id)
  INTO v_post_ids
  FROM instagram_posts
  WHERE user_id = p_id;

  -- Count media items before deletion
  SELECT COUNT(*)
  INTO v_deleted_media
  FROM instagram_post_media
  WHERE post_id = ANY(v_post_ids);

  -- Get all storage file paths for this account
  -- Storage paths follow pattern: {account_id}/{post_id}-{index}-{media|thumb}.{ext}
  BEGIN
    -- List all files in the account's storage folder
    SELECT ARRAY_AGG(name)
    INTO v_storage_files
    FROM storage.objects
    WHERE bucket_id = 'instagram-media'
      AND name LIKE p_id || '/%';

    -- Delete storage files if any exist
    IF v_storage_files IS NOT NULL AND array_length(v_storage_files, 1) > 0 THEN
      DELETE FROM storage.objects
      WHERE bucket_id = 'instagram-media'
        AND name = ANY(v_storage_files);

      GET DIAGNOSTICS v_deleted_files = ROW_COUNT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log but don't fail on storage deletion errors
    RAISE WARNING 'Failed to delete storage files for account %: %', p_id, SQLERRM;
  END;

  -- Delete database records (cascades will handle related tables)
  -- Order: instagram_post_media -> instagram_posts -> instagram_accounts

  -- Count posts before deletion
  SELECT COUNT(*)
  INTO v_deleted_posts
  FROM instagram_posts
  WHERE user_id = p_id;

  -- Delete the account (this will cascade to posts and media due to ON DELETE CASCADE)
  DELETE FROM instagram_accounts WHERE id = p_id;

  RETURN jsonb_build_object(
    'account_id', p_id,
    'deleted_posts', v_deleted_posts,
    'deleted_media', v_deleted_media,
    'deleted_files', v_deleted_files
  );
END;
$$;

-- Grant execute permission to service_role only (for security)
REVOKE ALL ON FUNCTION delete_instagram_account_data(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_instagram_account_data(BIGINT) TO service_role;

COMMIT;

