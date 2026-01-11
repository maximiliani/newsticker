# Instagram Integration - Quick Reference

## 🚀 Quick Start

### Deploy Changes
```bash
# 1. Apply database migrations
supabase migration up

# 2. Build and deploy
npm run build
# Deploy to your platform

# 3. Verify
# Check Supabase Dashboard > Database > Functions
# Should see: delete_instagram_account_data, cleanup_instagram_account_storage
```

---

## 📡 API Endpoints

### Refresh Instagram Posts
```http
POST /api/features/instagram/refresh
Headers:
  Cookie: <session-cookie>
  # OR
  x-internal-secret: <INTERNAL_ADMIN_SECRET>

Response:
{
  "ok": true,
  "scope": "all|current",
  "result": {
    "inserted": 0,
    "updated": 15,
    "deleted": 2,
    "downloaded": 45,
    "download_failed": 1
  }
}
```

### Delete Account
```http
DELETE /api/features/instagram/delete?accountId=123
Headers:
  Cookie: <session-cookie>

Response:
{
  "ok": true,
  "message": "Account deleted successfully",
  "stats": {
    "account_id": 123,
    "deleted_posts": 45,
    "deleted_media": 120,
    "deleted_files": 240
  }
}
```

---

## 🗄️ Database Functions

### Delete Account with Complete Cleanup
```sql
-- Returns JSON with deletion statistics
SELECT delete_instagram_account_data(123);

-- Result:
{
  "account_id": 123,
  "deleted_posts": 45,
  "deleted_media": 120,
  "deleted_files": 240
}
```

### Check Trigger Status
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_cleanup_instagram_account_storage';

-- Check trigger function
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'cleanup_instagram_account_storage';
```

---

## 🎨 UI Components

### Delete Account from UI
```typescript
import { InstagramService } from '@/features/instagram/services/instagram-service';

// In your component:
const handleDelete = async (accountId: number) => {
  try {
    await InstagramService.deleteAccount(accountId);
    // Refresh your list
  } catch (error) {
    console.error('Delete failed:', error);
  }
};
```

### Account Manager Component
```tsx
import { InstagramAccountsManager } from '@/features/instagram/components/instagram-accounts-manager';

<InstagramAccountsManager initialAccounts={accounts} />
```

---

## 🔍 Troubleshooting

### Check Storage Files
```sql
-- List files for an account
SELECT name, created_at 
FROM storage.objects 
WHERE bucket_id = 'instagram-media' 
  AND name LIKE '123/%'
ORDER BY created_at DESC;
```

### Manually Clean Up Orphaned Files
```sql
-- If trigger fails, manually clean up
DELETE FROM storage.objects
WHERE bucket_id = 'instagram-media'
  AND name LIKE '123/%';
```

### Check Post/Media Records
```sql
-- Count posts for an account
SELECT COUNT(*) FROM instagram_posts WHERE user_id = 123;

-- Count media items
SELECT COUNT(*) FROM instagram_post_media 
WHERE post_id IN (SELECT id FROM instagram_posts WHERE user_id = 123);
```

### View Logs
```typescript
// Look for these log patterns:
✓ Downloaded media X for post Y (Z bytes)
✗ Download attempt N/M failed for post X
Processing Instagram account X...
Completed account X: { inserted: 0, updated: 15, ... }
```

---

## 🔐 Security

### Authorization Levels
- **User**: Own accounts only
- **Admin**: All accounts
- **Cron/Internal**: Use `x-internal-secret` header

### Check User Permissions
```sql
-- Check if user is admin
SELECT check_is_admin();

-- Check account ownership
SELECT user_id FROM instagram_accounts WHERE id = 123;
```

---

## 📊 Monitoring Queries

### Account Statistics
```sql
SELECT 
  ia.id,
  ia.username,
  COUNT(DISTINCT ip.id) as post_count,
  COUNT(ipm.post_id) as media_count
FROM instagram_accounts ia
LEFT JOIN instagram_posts ip ON ip.user_id = ia.id
LEFT JOIN instagram_post_media ipm ON ipm.post_id = ip.id
GROUP BY ia.id, ia.username
ORDER BY post_count DESC;
```

### Storage Usage
```sql
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint as total_bytes
FROM storage.objects
WHERE bucket_id = 'instagram-media'
GROUP BY bucket_id;
```

### Recent Deletions
```sql
-- Check audit logs if enabled
-- Or monitor application logs for deletion events
```

---

## 🛠️ Maintenance Tasks

### Refresh All Accounts (Cron)
```bash
curl -X POST https://your-app.com/api/features/instagram/refresh \
  -H "x-internal-secret: $INTERNAL_ADMIN_SECRET"
```

### Delete Specific Account (Admin)
```bash
curl -X DELETE "https://your-app.com/api/features/instagram/delete?accountId=123" \
  -H "Cookie: your-session-cookie"
```

### Verify Database Functions
```sql
-- List all custom functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%instagram%';
```

---

## 📝 Type Definitions

### InstagramAccount
```typescript
interface InstagramAccount {
  id: number;  // BIGINT from database
  username: string;
  profile_image_url: string | null;
  user_id: string;
}
```

### RefreshMetrics
```typescript
interface RefreshMetrics {
  inserted: number;
  updated: number;
  deleted: number;
  downloaded: number;
  downloadFailed: number;
}
```

---

## 🔗 Related Files

- 📄 **COMPLETION_SUMMARY.md** - Full completion summary
- 📄 **REFACTORING_SUMMARY.md** - Technical details
- 📄 **ARCHITECTURE.md** - Visual diagrams
- 📄 **INSTAGRAM_REFACTORING_README.md** - Deployment guide

---

## 💡 Quick Tips

1. **Always check logs** for `✓`, `✗`, or `ℹ️` prefixed messages
2. **Verify triggers** after migration with SQL queries
3. **Test deletions** in staging before production
4. **Monitor storage** usage regularly
5. **Use admin panel** for bulk operations

---

## 🆘 Emergency Procedures

### If Deletion Fails
```sql
-- 1. Check if account exists
SELECT * FROM instagram_accounts WHERE id = 123;

-- 2. Manually delete posts
DELETE FROM instagram_posts WHERE user_id = 123;

-- 3. Manually clean storage
DELETE FROM storage.objects 
WHERE bucket_id = 'instagram-media' 
  AND name LIKE '123/%';

-- 4. Delete account
DELETE FROM instagram_accounts WHERE id = 123;
```

### If Trigger Doesn't Fire
```sql
-- Disable trigger
ALTER TABLE instagram_accounts DISABLE TRIGGER trigger_cleanup_instagram_account_storage;

-- Re-enable
ALTER TABLE instagram_accounts ENABLE TRIGGER trigger_cleanup_instagram_account_storage;

-- Or recreate
DROP TRIGGER IF EXISTS trigger_cleanup_instagram_account_storage ON instagram_accounts;
CREATE TRIGGER trigger_cleanup_instagram_account_storage
  BEFORE DELETE ON instagram_accounts
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_instagram_account_storage();
```

---

**Last Updated:** January 12, 2026  
**Version:** 2.0.0

