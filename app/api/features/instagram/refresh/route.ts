import {NextRequest, NextResponse} from "next/server";
import {createClient as createCookieAwareClient} from "@/lib/supabase/server";
import {createClient as createSupabaseServerClient} from "@supabase/supabase-js";
import {ALLOWED_CONTENT_TYPES, extFromContentType, MAX_FILE_SIZE, streamDownloadToBuffer} from "@/lib/storage/stream";
import type {SupabaseClient} from "@supabase/supabase-js";

// Configuration constants
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const INSTAGRAM_MEDIA_FIELDS = "id,caption,media_type,media_url,thumbnail_url,timestamp,children{id,media_type,media_url,thumbnail_url,timestamp}";
const FETCH_LIMIT = 50;

// Type definitions
interface MediaItem {
    index: number;
    media_type: string;
    media_url: string;
    thumbnail_url: string | null;
    timestamp: number;
}

interface DownloadResult {
    publicUrl: string;
    ct: string;
    size: number;
}

interface InstagramAccount {
    id: number;
    user_id: string;
}

interface RefreshMetrics {
    inserted: number;
    updated: number;
    deleted: number;
    downloaded: number;
    downloadFailed: number;
}

interface AuthContext {
    isAdmin: boolean;
    userId: string | null;
}

/**
 * Download media from Instagram and upload to Supabase storage
 * Implements retry logic with exponential backoff
 */
async function downloadAndUploadMedia(
    url: string,
    accountId: number,
    postId: number,
    mediaIndex: number,
    pathBase: string,
    mediaType: string,
    admin: SupabaseClient
): Promise<DownloadResult | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Download with timeout
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

            const res = await fetch(url, {signal: ctrl.signal});
            clearTimeout(timer);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            // Validate content type
            const contentType = res.headers.get("content-type") || "application/octet-stream";
            if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
                throw new Error(`Unsupported content type: ${contentType}`);
            }

            // Validate file size
            const contentLength = res.headers.get("content-length");
            if (contentLength) {
                const size = parseInt(contentLength, 10);
                if (!isNaN(size) && size > MAX_FILE_SIZE) {
                    throw new Error(`File too large: ${size} bytes (max: ${MAX_FILE_SIZE})`);
                }
            }

            // Download file
            const {buffer, size} = await streamDownloadToBuffer(res);

            // Determine file extension
            const ext = extFromContentType(contentType) || (mediaType === "video" ? ".mp4" : ".jpg");
            const storagePath = `${accountId}/${postId}-${mediaIndex}${pathBase}${ext}`;

            // Upload to storage
            const {error: uploadErr} = await admin.storage
                .from("instagram-media")
                .upload(storagePath, buffer, {upsert: true, contentType});

            if (uploadErr) {
                throw new Error(`Upload failed: ${uploadErr.message}`);
            }

            // Get public URL
            const {data: pub} = admin.storage
                .from("instagram-media")
                .getPublicUrl(storagePath);

            if (!pub?.publicUrl) {
                throw new Error("No public URL returned");
            }

            console.info(`✓ Downloaded media ${mediaIndex} for post ${postId} (${size} bytes)`);
            return {publicUrl: pub.publicUrl, ct: contentType, size};

        } catch (error: any) {
            const isLastAttempt = attempt === MAX_RETRIES;
            console.warn(
                `✗ Download attempt ${attempt + 1}/${MAX_RETRIES + 1} failed for post ${postId}, media ${mediaIndex}: ${error?.message || error}`
            );

            if (isLastAttempt) {
                return null;
            }

            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
        }
    }

    return null;
}

/**
 * Parse Instagram API response into standardized media items
 * Handles both single media posts and carousel albums
 */
function parseMediaItems(item: any, postTimestamp: number): MediaItem[] {
    const topLevelMediaType = String(item.media_type || "IMAGE").toUpperCase();

    if (topLevelMediaType === "CAROUSEL_ALBUM" && item.children?.data) {
        // Carousel post: process all children
        return item.children.data.map((child: any, idx: number) => {
            const childMediaType = String(child.media_type || "IMAGE").toUpperCase() === "VIDEO" ? "video" : "image";
            const timestamp = child.timestamp || postTimestamp;

            return {
                index: idx,
                media_type: childMediaType,
                media_url: child.media_url || child.thumbnail_url,
                thumbnail_url: child.thumbnail_url || null,
                timestamp: Math.floor(new Date(timestamp).getTime() / 1000),
            };
        });
    } else {
        // Single media post
        const mediaType = topLevelMediaType === "VIDEO" ? "video" : "image";
        return [{
            index: 0,
            media_type: mediaType,
            media_url: item.media_url || item.thumbnail_url,
            thumbnail_url: item.thumbnail_url || null,
            timestamp: postTimestamp,
        }];
    }
}

/**
 * Process and store a single media item
 * Downloads media files and stores metadata in database
 */
async function processMediaItem(
    mediaItem: MediaItem,
    postId: number,
    accountId: number,
    admin: SupabaseClient
): Promise<{downloaded: number; failed: number}> {
    let localMediaUrl: string | null = null;
    let localThumbUrl: string | null = null;
    let fileSize: number | null = null;
    let mimeType: string | null = null;
    let downloadStatus: "completed" | "failed" = "failed";
    let downloadError: string | null = null;

    // Download primary media
    const mediaRes = mediaItem.media_url
        ? await downloadAndUploadMedia(
            mediaItem.media_url,
            accountId,
            postId,
            mediaItem.index,
            "-media",
            mediaItem.media_type,
            admin
        )
        : null;

    if (mediaRes) {
        localMediaUrl = mediaRes.publicUrl;
        fileSize = mediaRes.size;
        mimeType = mediaRes.ct;
        downloadStatus = "completed";
        console.info(`✓ Successfully stored media ${mediaItem.index} for post ${postId}`);
    } else {
        downloadStatus = "failed";
        downloadError = "Download failed";
        console.warn(`✗ Failed to store media ${mediaItem.index} for post ${postId}`);
    }

    // Download thumbnail if available
    if (mediaItem.thumbnail_url) {
        const thumbRes = await downloadAndUploadMedia(
            mediaItem.thumbnail_url,
            accountId,
            postId,
            mediaItem.index,
            "-thumb",
            mediaItem.media_type,
            admin
        );
        if (thumbRes) {
            localThumbUrl = thumbRes.publicUrl;
        }
    }

    // Store media metadata in database
    const {error: upMediaErr} = await admin
        .from("instagram_post_media")
        .upsert({
            post_id: postId,
            index: mediaItem.index,
            media_type: mediaItem.media_type,
            media_url: mediaItem.media_url,
            thumbnail_url: mediaItem.thumbnail_url,
            timestamp: mediaItem.timestamp,
            local_media_url: localMediaUrl,
            local_thumbnail_url: localThumbUrl,
            file_size: fileSize,
            mime_type: mimeType,
            download_status: downloadStatus,
            download_error: downloadError,
            downloaded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }, {onConflict: "post_id,index"});

    if (upMediaErr) {
        console.warn(`Failed to upsert media for post ${postId}, index ${mediaItem.index}:`, upMediaErr.message);
        return {downloaded: 0, failed: 1};
    }

    return {
        downloaded: downloadStatus === "completed" ? 1 : 0,
        failed: downloadStatus === "failed" ? 1 : 0
    };
}

/**
 * Authenticate and authorize the request
 * Returns auth context or throws error
 */
async function authenticateRequest(
    req: NextRequest,
    supabase: SupabaseClient
): Promise<AuthContext> {
    const secretHeader = req.headers.get("x-internal-secret");
    const internalSecret = process.env.INTERNAL_ADMIN_SECRET;

    // Check for internal secret (for cron jobs)
    if (internalSecret && secretHeader && internalSecret === secretHeader) {
        return {isAdmin: true, userId: null};
    }

    // Session-based authentication
    const {data: userRes} = await supabase.auth.getUser();
    const userId = userRes.user?.id || null;

    if (!userId) {
        throw new Error("Unauthorized");
    }

    const {data: isAdminData, error: isAdminErr} = await supabase.rpc("check_is_admin");
    if (isAdminErr) {
        throw new Error(`Admin check failed: ${isAdminErr.message}`);
    }

    return {
        isAdmin: !!isAdminData,
        userId
    };
}

/**
 * Fetch Instagram accounts based on auth context
 */
async function fetchTargetAccounts(
    authContext: AuthContext,
    supabase: SupabaseClient,
    admin: SupabaseClient
): Promise<InstagramAccount[]> {
    if (authContext.isAdmin) {
        const {data: accounts, error} = await admin
            .from("instagram_accounts")
            .select("id,user_id");

        if (error) {
            throw new Error(`Failed to fetch accounts: ${error.message}`);
        }

        return (accounts || []) as InstagramAccount[];
    } else {
        const {data: accounts, error} = await supabase
            .from("instagram_accounts")
            .select("id,user_id")
            .eq("user_id", authContext.userId);

        if (error) {
            throw new Error(`Failed to fetch accounts: ${error.message}`);
        }

        return (accounts || []) as InstagramAccount[];
    }
}

/**
 * Fetch posts from Instagram API for an account
 */
async function fetchInstagramPosts(
    account: InstagramAccount,
    admin: SupabaseClient
): Promise<any[]> {
    const params = {
        fields: INSTAGRAM_MEDIA_FIELDS,
        limit: FETCH_LIMIT
    };

    const {data: apiResp, error: apiErr} = await admin.rpc("instagram_api_request", {
        p_route: "me/media",
        p_params: params,
        p_account_id: account.id,
        p_user_id: account.user_id,
    });

    if (apiErr) {
        console.warn(`Instagram API error for account ${account.id}:`, apiErr.message);
        return [];
    }

    const status = Number(apiResp?.status || 0);
    if (status < 200 || status >= 300) {
        console.warn(`Instagram API returned status ${status} for account ${account.id}`);
        return [];
    }

    return Array.isArray(apiResp?.body?.data) ? apiResp.body.data : [];
}

/**
 * Upsert a post to the database
 */
async function upsertPost(
    postData: {
        id: number;
        accountId: number;
        caption: string | null;
        timestamp: string;
        timestampUnix: number;
    },
    admin: SupabaseClient
): Promise<boolean> {
    const {error} = await admin
        .from("instagram_posts")
        .upsert({
            id: postData.id,
            user_id: postData.accountId,
            caption: postData.caption,
            posted_at: postData.timestamp,
            timestamp: postData.timestampUnix,
            created_at: postData.timestamp,
            updated_at: new Date().toISOString(),
        }, {onConflict: "id"});

    if (error) {
        console.warn(`Failed to upsert post ${postData.id}:`, error.message);
        return false;
    }

    return true;
}

/**
 * Delete posts that no longer exist on Instagram
 */
async function deleteRemovedPosts(
    account: InstagramAccount,
    remotePostIds: Set<number>,
    oldestTimestampMs: number,
    admin: SupabaseClient
): Promise<number> {
    try {
        // Fetch existing posts
        const {data: existingRows, error} = await admin
            .from("instagram_posts")
            .select("id, posted_at")
            .eq("user_id", account.id);

        if (error || !Array.isArray(existingRows)) {
            console.warn(`Failed to fetch existing posts for account ${account.id}`);
            return 0;
        }

        // Find posts to delete (not in remote IDs and within fetch window)
        const toDelete = existingRows
            .filter((row: any) => {
                const postId = Number(row.id);
                const postedAt = Date.parse(row.posted_at);

                return !remotePostIds.has(postId) &&
                       (!Number.isFinite(oldestTimestampMs) || postedAt >= oldestTimestampMs);
            })
            .map((row: any) => Number(row.id));

        if (toDelete.length === 0) {
            return 0;
        }

        // Delete storage files
        const {data: files} = await admin.storage
            .from("instagram-media")
            .list(`${account.id}`);

        for (const postId of toDelete) {
            try {
                // Remove storage files for this post
                const paths = (files || [])
                    .filter((f: any) => f.name && f.name.startsWith(`${postId}-`))
                    .map((f: any) => `${account.id}/${f.name}`);

                if (paths.length > 0) {
                    await admin.storage.from("instagram-media").remove(paths);
                }

                // Delete database record (cascades to media)
                await admin.from("instagram_posts").delete().eq("id", postId);
            } catch (error) {
                console.warn(`Failed to delete post ${postId}:`, error);
            }
        }

        return toDelete.length;
    } catch (error) {
        console.warn(`Error deleting removed posts for account ${account.id}:`, error);
        return 0;
    }
}

/**
 * Process a single Instagram account
 */
async function processAccount(
    account: InstagramAccount,
    admin: SupabaseClient
): Promise<RefreshMetrics> {
    const metrics: RefreshMetrics = {
        inserted: 0,
        updated: 0,
        deleted: 0,
        downloaded: 0,
        downloadFailed: 0
    };

    // Fetch posts from Instagram
    const posts = await fetchInstagramPosts(account, admin);
    if (posts.length === 0) {
        return metrics;
    }

    const remotePostIds = new Set<number>();

    // Process each post
    for (const item of posts) {
        const postId = Number(item.id);
        remotePostIds.add(postId);

        const timestamp = item.timestamp;
        const timestampUnix = Math.floor(new Date(timestamp).getTime() / 1000);
        const caption = item.caption || null;

        // Upsert post
        const success = await upsertPost({
            id: postId,
            accountId: account.id,
            caption,
            timestamp,
            timestampUnix
        }, admin);

        if (!success) {
            continue;
        }

        // Parse and process media
        const mediaItems = parseMediaItems(item, timestampUnix);

        for (const mediaItem of mediaItems) {
            const result = await processMediaItem(mediaItem, postId, account.id, admin);
            metrics.downloaded += result.downloaded;
            metrics.downloadFailed += result.failed;
        }

        // Track insert vs update (simplified heuristic)
        metrics.updated += 1;
    }

    // Delete posts no longer on Instagram
    const oldestTimestampMs = posts.reduce((min: number, item: any) => {
        const t = Date.parse(item?.timestamp ?? '');
        return Number.isFinite(t) ? Math.min(min, t) : min;
    }, Number.POSITIVE_INFINITY);

    metrics.deleted = await deleteRemovedPosts(account, remotePostIds, oldestTimestampMs, admin);

    return metrics;
}

export async function POST(req: NextRequest) {
    const supabase = await createCookieAwareClient();

    try {
        // Authenticate and authorize
        const authContext = await authenticateRequest(req, supabase);
        console.debug("Instagram refresh initiated", authContext);

        // Setup service-role client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json(
                {error: "Supabase service credentials not configured"},
                {status: 500}
            );
        }

        const admin = createSupabaseServerClient(supabaseUrl, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Fetch target accounts
        const accounts = await fetchTargetAccounts(authContext, supabase, admin);

        if (accounts.length === 0) {
            return NextResponse.json({
                ok: true,
                scope: authContext.isAdmin ? "all" : "current",
                result: {
                    inserted: 0,
                    updated: 0,
                    deleted: 0,
                    downloaded: 0,
                    download_failed: 0
                }
            });
        }

        // Process all accounts and aggregate metrics
        const totalMetrics: RefreshMetrics = {
            inserted: 0,
            updated: 0,
            deleted: 0,
            downloaded: 0,
            downloadFailed: 0
        };

        for (const account of accounts) {
            console.info(`Processing Instagram account ${account.id}...`);
            const accountMetrics = await processAccount(account, admin);

            totalMetrics.inserted += accountMetrics.inserted;
            totalMetrics.updated += accountMetrics.updated;
            totalMetrics.deleted += accountMetrics.deleted;
            totalMetrics.downloaded += accountMetrics.downloaded;
            totalMetrics.downloadFailed += accountMetrics.downloadFailed;

            console.info(`Completed account ${account.id}:`, accountMetrics);
        }

        return NextResponse.json({
            ok: true,
            scope: authContext.isAdmin ? "all" : "current",
            result: {
                inserted: totalMetrics.inserted,
                updated: totalMetrics.updated,
                deleted: totalMetrics.deleted,
                downloaded: totalMetrics.downloaded,
                download_failed: totalMetrics.downloadFailed
            }
        });
    } catch (error: any) {
        console.error("Instagram refresh error:", error);

        const status = error.message === "Unauthorized" ? 401 : 500;
        return NextResponse.json(
            {error: error?.message || "Unexpected error"},
            {status}
        );
    }
}
