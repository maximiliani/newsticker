# Instagram Refresh API - Architecture Overview

## Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         POST /api/features/instagram/refresh     │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  authenticateRequest()   │
                    │  - Check internal secret │
                    │  - Verify user session   │
                    │  - Check admin status    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ fetchTargetAccounts()   │
                    │  - All (if admin)       │
                    │  - User's only (normal) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   For Each Account:     │
                    │   processAccount()      │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼─────┐        ┌───────▼────────┐     ┌───────▼────────┐
    │  Fetch   │        │    Process      │     │    Delete      │
    │  Posts   │───────▶│  Each Post      │────▶│  Removed Posts │
    └──────────┘        └────────┬────────┘     └────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     upsertPost()        │
                    │  Store post metadata    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   parseMediaItems()     │
                    │  - Single media         │
                    │  - Carousel album       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  For Each Media Item:   │
                    │  processMediaItem()     │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼─────┐        ┌───────▼────────┐     ┌───────▼────────┐
    │ Download │        │   Download      │     │   Store to     │
    │  Media   │        │  Thumbnail      │     │   Database     │
    └──────────┘        └────────────────┘     └────────────────┘
         │
    ┌────▼─────────────────────────────┐
    │ downloadAndUploadMedia()         │
    │  - Download with retry           │
    │  - Validate content type/size    │
    │  - Upload to Supabase Storage    │
    │  - Return public URL             │
    └──────────────────────────────────┘
```

## Function Hierarchy

```
POST()
├── authenticateRequest()
│   └── Returns: AuthContext {isAdmin, userId}
│
├── fetchTargetAccounts()
│   └── Returns: InstagramAccount[]
│
└── For each account: processAccount()
    ├── fetchInstagramPosts()
    │   └── Returns: Instagram API response[]
    │
    ├── For each post:
    │   ├── upsertPost()
    │   │   └── Inserts/updates post in database
    │   │
    │   ├── parseMediaItems()
    │   │   └── Returns: MediaItem[]
    │   │
    │   └── For each media: processMediaItem()
    │       ├── downloadAndUploadMedia() [primary media]
    │       ├── downloadAndUploadMedia() [thumbnail]
    │       └── Upsert to instagram_post_media table
    │
    └── deleteRemovedPosts()
        ├── List storage files
        ├── Delete storage files for removed posts
        └── Delete database records
```

## Database Cleanup Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DELETE Account Scenario                      │
└────────────────────────────────────────┬────────────────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │  Manual or Automated    │
                            │  DELETE FROM            │
                            │  instagram_accounts     │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │  TRIGGER FIRES:         │
                            │  BEFORE DELETE          │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │ cleanup_instagram_      │
                            │ account_storage()       │
                            │ - Deletes all files     │
                            │   in storage.objects    │
                            │   matching account ID   │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │  Account Deleted        │
                            │  CASCADE triggers       │
                            └────────────┬────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                                         │
       ┌────────────▼────────────┐           ┌───────────────▼──────────┐
       │  DELETE FROM            │           │  DELETE FROM             │
       │  instagram_posts        │──────────▶│  instagram_post_media    │
       │  WHERE user_id = X      │  CASCADE  │  WHERE post_id IN (...)  │
       └─────────────────────────┘           └──────────────────────────┘
```

## Key Components

### Configuration
- `TIMEOUT_MS`: 30 seconds per download
- `MAX_RETRIES`: 2 retry attempts
- `INSTAGRAM_MEDIA_FIELDS`: Fields to fetch from Instagram API
- `FETCH_LIMIT`: 50 posts per request

### Type Safety
All functions use TypeScript interfaces:
- `MediaItem`: Represents Instagram media
- `DownloadResult`: Download operation result
- `InstagramAccount`: Account data
- `RefreshMetrics`: Operation statistics
- `AuthContext`: Authentication context

### Error Handling Strategy
1. **Authentication errors**: Throw and return 401
2. **API errors**: Log and skip account (don't fail entire operation)
3. **Download errors**: Retry with exponential backoff
4. **Storage errors**: Log warning but don't block deletion
5. **Database errors**: Log and skip item

### Metrics Tracking
Each operation tracks:
- `inserted`: New posts added
- `updated`: Existing posts updated
- `deleted`: Posts removed
- `downloaded`: Media successfully downloaded
- `downloadFailed`: Media download failures

## Security Model

```
┌─────────────────────────────────────────┐
│         Authentication Layer            │
├─────────────────────────────────────────┤
│  1. Internal Secret (Cron Jobs)         │
│     - Full admin access                 │
│     - All accounts                      │
├─────────────────────────────────────────┤
│  2. User Session (Authenticated)        │
│     - Check admin via check_is_admin()  │
│     - Admin: All accounts               │
│     - User: Own accounts only           │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│      Database Function Security         │
├─────────────────────────────────────────┤
│  - delete_instagram_account_data()      │
│    SECURITY DEFINER                     │
│    Granted to: service_role only        │
├─────────────────────────────────────────┤
│  - cleanup_instagram_account_storage()  │
│    SECURITY DEFINER (trigger function)  │
│    Runs with elevated privileges        │
└─────────────────────────────────────────┘
```

## Storage Organization

```
instagram-media/
├── {account_id_1}/
│   ├── {post_id_1}-0-media.jpg
│   ├── {post_id_1}-0-thumb.jpg
│   ├── {post_id_2}-0-media.mp4
│   ├── {post_id_2}-0-thumb.jpg
│   ├── {post_id_3}-0-media.jpg     (carousel)
│   ├── {post_id_3}-1-media.jpg     (carousel)
│   ├── {post_id_3}-2-media.jpg     (carousel)
│   └── ...
├── {account_id_2}/
│   └── ...
└── ...
```

Format: `{account_id}/{post_id}-{index}-{type}.{ext}`
- `account_id`: Instagram account ID
- `post_id`: Instagram post ID
- `index`: Media index (0 for single, 0+ for carousel)
- `type`: "media" or "thumb"
- `ext`: File extension based on content type

