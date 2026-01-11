# Instagram API Refactoring Summary

## Changes Made

### 1. Code Refactoring (`app/api/features/instagram/refresh/route.ts`)

The Instagram refresh route has been completely refactored for improved maintainability, readability, and type safety:

#### **Improved Type Definitions**
- Added comprehensive TypeScript interfaces:
  - `MediaItem`: Represents a single media item from Instagram
  - `DownloadResult`: Download operation result
  - `InstagramAccount`: Account data structure
  - `RefreshMetrics`: Tracks operation metrics
  - `AuthContext`: Authentication context

#### **Configuration Constants**
- Centralized configuration values at the top of the file:
  - `TIMEOUT_MS`: Download timeout
  - `MAX_RETRIES`: Retry attempts for failed downloads
  - `INSTAGRAM_MEDIA_FIELDS`: API fields to fetch
  - `FETCH_LIMIT`: Maximum posts to fetch per request

#### **Modular Function Architecture**
The monolithic POST handler has been broken down into focused, single-responsibility functions:

1. **`downloadAndUploadMedia()`**
   - Downloads media from Instagram with timeout and retry logic
   - Validates content type and file size
   - Uploads to Supabase storage
   - Returns download result or null on failure

2. **`parseMediaItems()`**
   - Parses Instagram API response into standardized media items
   - Handles both single media posts and carousel albums
   - Normalizes timestamps and media types

3. **`processMediaItem()`**
   - Downloads primary media and optional thumbnail
   - Stores metadata in database
   - Tracks download status and errors
   - Returns success/failure metrics

4. **`authenticateRequest()`**
   - Handles authentication via internal secret or user session
   - Checks admin privileges
   - Returns structured auth context
   - Throws clear errors for unauthorized access

5. **`fetchTargetAccounts()`**
   - Fetches Instagram accounts based on auth context
   - Admins see all accounts, users see only their own
   - Returns typed account array

6. **`fetchInstagramPosts()`**
   - Fetches posts from Instagram API for a specific account
   - Handles API errors gracefully
   - Returns empty array on failure (doesn't crash)

7. **`upsertPost()`**
   - Inserts or updates a post in the database
   - Returns boolean success status
   - Logs errors without throwing

8. **`deleteRemovedPosts()`**
   - Identifies posts that no longer exist on Instagram
   - Deletes associated storage files
   - Removes database records (cascades to media)
   - Returns count of deleted posts

9. **`processAccount()`**
   - Orchestrates the complete refresh process for one account
   - Fetches posts, processes media, and cleans up deleted content
   - Returns aggregated metrics

10. **`POST()` (Main Handler)**
    - Simplified to orchestrate high-level flow
    - Authenticates request
    - Fetches accounts
    - Processes each account
    - Aggregates and returns metrics

#### **Benefits of Refactoring**
- **Testability**: Each function can be tested independently
- **Readability**: Clear function names and responsibilities
- **Maintainability**: Easy to modify specific functionality
- **Type Safety**: Comprehensive TypeScript types prevent errors
- **Error Handling**: Consistent error logging and graceful degradation
- **Reusability**: Functions can be reused in other contexts

---

### 2. Database Cleanup Functions

#### **Account Deletion Function** (`20260112000000_instagram_account_deletion.sql`)

Created `delete_instagram_account_data(p_id BIGINT)` function:
- Accepts Instagram account ID as parameter
- Deletes all storage files for the account from the `instagram-media` bucket
- Deletes all database records (cascades automatically to posts and media)
- Returns JSON with deletion statistics:
  ```json
  {
    "account_id": 123,
    "deleted_posts": 45,
    "deleted_media": 120,
    "deleted_files": 240
  }
  ```
- Uses `SECURITY DEFINER` to run with elevated privileges
- Granted to `service_role` only for security

**Usage:**
```sql
SELECT delete_instagram_account_data(account_id);
```

#### **Automatic Storage Cleanup Trigger** (`20260112000001_instagram_storage_cleanup_trigger.sql`)

Created automatic trigger for storage cleanup:
- Trigger: `trigger_cleanup_instagram_account_storage`
- Fires: `BEFORE DELETE` on `instagram_accounts` table
- Function: `cleanup_instagram_account_storage()`
- Automatically removes all storage files when an account is deleted
- Logs warnings if storage deletion fails (doesn't block account deletion)
- Ensures database and storage stay in sync

**How it works:**
```sql
-- When you delete an account:
DELETE FROM instagram_accounts WHERE id = 123;

-- The trigger automatically:
-- 1. Deletes all files in storage.objects where name LIKE '123/%'
-- 2. Logs the number of files deleted
-- 3. Database CASCADE deletes instagram_posts and instagram_post_media
```

---

### 3. Database Schema Relationships

The existing schema already has proper CASCADE rules:

```
auth.users
    └─ ON DELETE CASCADE ─> instagram_accounts
           └─ ON DELETE CASCADE ─> instagram_posts
                  └─ ON DELETE CASCADE ─> instagram_post_media
```

**What happens when deleting an account:**
1. Trigger fires and deletes all storage files for the account
2. Account record is deleted from `instagram_accounts`
3. CASCADE deletes all records from `instagram_posts` where `user_id` matches
4. CASCADE deletes all records from `instagram_post_media` for those posts

**What happens when deleting a user:**
1. CASCADE deletes all records from `instagram_accounts` for that user
2. Triggers fire for each account deletion (storage cleanup)
3. Further CASCADEs delete posts and media

---

## Testing Recommendations

### Unit Tests
Test each function independently:
- `parseMediaItems()` with various API responses
- `downloadAndUploadMedia()` with mocked fetch
- `authenticateRequest()` with different auth scenarios
- `deleteRemovedPosts()` with various post sets

### Integration Tests
- Complete refresh flow for a single account
- Multiple accounts refresh
- Account deletion with storage cleanup
- Handling of API failures and timeouts

### Database Tests
1. Test account deletion function:
   ```sql
   -- Create test account and posts
   -- Call delete_instagram_account_data()
   -- Verify all records and files are gone
   ```

2. Test trigger:
   ```sql
   -- Create test account with storage files
   -- DELETE FROM instagram_accounts
   -- Verify storage files are removed
   ```

---

## Migration Path

### Apply Migrations

```bash
# Apply the new migrations to your database
supabase migration up
```

Or if using the Supabase dashboard, paste the SQL from the migration files.

### Verify Deployment

1. Check that new functions exist:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name IN ('delete_instagram_account_data', 'cleanup_instagram_account_storage');
   ```

2. Check that trigger exists:
   ```sql
   SELECT trigger_name 
   FROM information_schema.triggers 
   WHERE trigger_name = 'trigger_cleanup_instagram_account_storage';
   ```

3. Test the refresh endpoint:
   ```bash
   curl -X POST https://your-app.com/api/features/instagram/refresh \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

---

## Security Considerations

1. **Function Permissions**: 
   - `delete_instagram_account_data()` is only granted to `service_role`
   - Prevents unauthorized account deletion

2. **Storage Access**:
   - Trigger runs with `SECURITY DEFINER` to delete storage files
   - Only fires when account deletion is authorized

3. **Authentication**:
   - Internal secret for cron jobs (`INTERNAL_ADMIN_SECRET`)
   - User session authentication for manual triggers
   - Admin checks for cross-user operations

---

## Performance Improvements

1. **Reduced API Calls**: Helper functions prevent redundant database queries
2. **Batch Operations**: Posts and media processed in batches
3. **Efficient Storage Deletion**: Single query to list and delete files
4. **Early Returns**: Functions return early on errors to save resources

---

## Future Enhancements

1. **Parallel Processing**: Process multiple accounts concurrently
2. **Progress Tracking**: Add progress updates for long-running operations
3. **Webhook Support**: Notify on completion/failure
4. **Metrics Dashboard**: Visualize refresh statistics
5. **Selective Refresh**: Refresh only specific posts or date ranges

