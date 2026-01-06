import {NextRequest, NextResponse} from "next/server";
import {createClient as createCookieAwareClient} from "@/lib/supabase/server";
import {createClient as createSupabaseServerClient} from "@supabase/supabase-js";
import {ALLOWED_CONTENT_TYPES, extFromContentType, MAX_FILE_SIZE, streamDownloadToBuffer} from "@/lib/storage/stream";

// Local media cloning parameters (aligned with storage policies and legacy Edge Function)
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

export async function POST(req: NextRequest) {
    const supabase = await createCookieAwareClient();
    try {
        // 0) Authn / Authz: allow internal secret for M2M/admin cron
        const secretHeader = req.headers.get("x-internal-secret");
        const internalSecret = process.env.INTERNAL_ADMIN_SECRET;

        let isAdmin = false;
        let userId: string | null = null;

        if (internalSecret && secretHeader && internalSecret === secretHeader) {
            // Trusted internal call: run as admin across all users
            isAdmin = true;
        } else {
            // Session-based
            const {data: userRes} = await supabase.auth.getUser();
            userId = userRes.user?.id || null;
            if (!userId) {
                return NextResponse.json({error: "Unauthorized"}, {status: 401});
            }
            const {data: isAdminData, error: isAdminErr} = await supabase.rpc("check_is_admin");
            if (isAdminErr) {
                return NextResponse.json({error: isAdminErr.message}, {status: 500});
            }
            isAdmin = !!isAdminData;
        }
        console.debug("Instagram refresh initiated", {isAdmin, userId});

        // 2) Setup service-role client for DB writes and Storage uploads
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({error: "Supabase service credentials not configured"}, {status: 500});
        }
        const admin = createSupabaseServerClient(supabaseUrl, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 3) Determine target accounts
        let accounts: Array<{ id: number; user_id: string }> = [];
        if (isAdmin) {
            const {data: accs, error: accErr} = await admin.from("instagram_accounts").select("id,user_id");
            if (accErr) return NextResponse.json({error: accErr.message}, {status: 500});
            accounts = (accs || []) as any;
        } else {
            const {
                data: accs,
                error: accErr
            } = await supabase.from("instagram_accounts").select("id,user_id").eq("user_id", userId);
            if (accErr) return NextResponse.json({error: accErr.message}, {status: 500});
            accounts = (accs || []) as any;
        }

        // Metrics
        let inserted = 0;
        let updated = 0;
        let deleted = 0;
        let downloads = 0;
        let downloadFailed = 0;

        for (const acc of accounts) {
            // 4) Fetch recent media via DB-side IG proxy (tokens remain in DB)
            const params = {fields: "id,caption,media_type,media_url,thumbnail_url,timestamp", limit: 50} as any;
            const {data: apiResp, error: apiErr} = await admin.rpc("instagram_api_request", {
                p_route: "me/media",
                p_params: params,
                p_account_id: acc.id,
                p_user_id: acc.user_id,
            });
            console.debug("Fetched data via RPC:", apiResp || "no response", apiErr || "no errors");
            if (apiErr) {
                console.warn(`Instagram API error for account ${acc.id}, user ${acc.user_id}:`, apiErr.message);
                // skip this account
                continue;
            }
            const status = Number(apiResp?.status || 0);
            if (status < 200 || status >= 300) {
                console.warn(`Instagram API returned non-2xx status for account ${acc.id}, user ${acc.user_id}:`, status, apiResp?.body || "");
                continue;
            }
            const dataArray = Array.isArray(apiResp?.body?.data) ? apiResp.body.data : [];
            const remoteIds = new Set<number>();

            for (const item of dataArray) {
                const postId = Number(item.id);
                remoteIds.add(postId);
                const tsIso = item.timestamp;
                const ts = Math.floor(new Date(tsIso).getTime() / 1000);
                const caption = item.caption || null;
                const mediaType = String(item.media_type || "IMAGE").toUpperCase() === "VIDEO" ? "video" : "image";
                const mediaUrl: string = item.media_url || item.thumbnail_url;
                const thumbUrl: string | null = item.thumbnail_url || null;

                // 5) Upsert post
                const {error: upPostErr} = await admin.from("instagram_posts").upsert({
                    id: postId,
                    user_id: acc.id,
                    caption,
                    posted_at: tsIso,
                    timestamp: ts,
                    created_at: tsIso,
                    updated_at: new Date().toISOString(),
                }, {onConflict: "id"});
                if (upPostErr) {
                    console.warn(`Failed to upsert instagram_posts for post ${postId}, account ${acc.id}:`, upPostErr.message);
                    continue;
                }

                // 6) Prepare storage paths
                let localMediaUrl: string | null = null;
                let localThumbUrl: string | null = null;
                let fileSize: number | null = null;
                let mimeType: string | null = null;
                let downloadStatus: "completed" | "failed" = "failed";
                let downloadError: string | null = null;

                // Helper to download and upload a single file
                const downloadAndUpload = async (url: string, pathBase: string): Promise<{
                    publicUrl: string;
                    ct: string;
                    size: number
                } | null> => {
                    let attempt = 0;
                    let lastErr: any = null;
                    while (attempt <= MAX_RETRIES) {
                        try {
                            const ctrl = new AbortController();
                            const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
                            const res = await fetch(url, {signal: ctrl.signal});
                            clearTimeout(timer);
                            if (!res.ok) throw new Error(`Download failed: ${res.status}`);
                            const ct = res.headers.get("content-type") || "application/octet-stream";
                            if (!ALLOWED_CONTENT_TYPES.has(ct)) throw new Error(`Unsupported content type: ${ct}`);
                            const lenHeader = res.headers.get("content-length");
                            if (lenHeader) {
                                const len = parseInt(lenHeader, 10);
                                if (!Number.isNaN(len) && len > MAX_FILE_SIZE) throw new Error(`File too large: ${len} bytes`);
                            }
                            const {buffer, size} = await streamDownloadToBuffer(res);
                            const ext = extFromContentType(ct) || (mediaType === "video" ? ".mp4" : ".jpg");
                            const storagePath = `${acc.id}/${postId}-0${pathBase}${ext}`; // e.g., 123/9876-0-media.jpg
                            const {error: upErr} = await admin.storage
                                .from("instagram-media")
                                .upload(storagePath, buffer, {upsert: true, contentType: ct});
                            if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
                            const {data: pub} = admin.storage.from("instagram-media").getPublicUrl(storagePath);
                            if (!pub?.publicUrl) throw new Error("No public URL returned");
                            return {publicUrl: pub.publicUrl, ct, size};
                        } catch (e: any) {
                            console.warn("Download/upload attempt failed:", e?.message || e);
                            lastErr = e;
                            attempt += 1;
                            if (attempt > MAX_RETRIES) break;
                            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
                        }
                    }
                    downloadError = lastErr?.message || String(lastErr) || "Unknown error";
                    return null;
                };

                // 7) Clone media and optional thumbnail
                const mediaRes = mediaUrl ? await downloadAndUpload(mediaUrl, "-media") : null;
                if (mediaRes) {
                    localMediaUrl = mediaRes.publicUrl;
                    fileSize = mediaRes.size;
                    mimeType = mediaRes.ct;
                    downloadStatus = "completed";
                    console.info("Successfully cloned media for post", postId);
                } else {
                    downloadStatus = "failed";
                    console.info("Failed to clone media for post", postId);
                }

                if (thumbUrl) {
                    const thumbRes = await downloadAndUpload(thumbUrl, "-thumb");
                    if (thumbRes) {
                        localThumbUrl = thumbRes.publicUrl;
                    }
                }

                // 8) Upsert media row with local URLs and download status
                const {error: upMediaErr} = await admin.from("instagram_post_media").upsert({
                    post_id: postId,
                    index: 0,
                    media_type: mediaType,
                    media_url: mediaUrl,
                    thumbnail_url: thumbUrl,
                    timestamp: ts,
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
                    downloadFailed += 1;
                } else {
                    downloads += downloadStatus === "completed" ? 1 : 0;
                }

                // Track counts similar to DB function
                // We can't reliably know if upsert was insert or update without returning, so use a heuristic: fetch
                const {data: exists} = await admin.from("instagram_posts").select("id").eq("id", postId).limit(1);
                if (exists && exists.length === 1) {
                    updated += 1; // counting as update for simplicity
                } else {
                    inserted += 1;
                }
            }

            // 9) Delete posts that no longer exist remotely (within the fetched window)
            try {
                // Determine the oldest timestamp among fetched posts to avoid deleting older posts outside the fetch window
                const oldestTsMs = dataArray.reduce((min: number, it: any) => {
                    const t = Date.parse(it?.timestamp ?? '');
                    return Number.isFinite(t) ? Math.min(min, t) : min;
                }, Number.POSITIVE_INFINITY);

                const {data: existingRows, error: exErr} = await admin
                    .from("instagram_posts")
                    .select("id, posted_at")
                    .eq("user_id", acc.id);
                if (!exErr && Array.isArray(existingRows)) {
                    const toDelete = existingRows
                        .filter((r: any) => !remoteIds.has(Number(r.id)) && (!Number.isFinite(oldestTsMs) || (Date.parse(r.posted_at) >= oldestTsMs)))
                        .map((r: any) => Number(r.id));
                    if (toDelete.length > 0) {
                        // List files in the account folder once
                        const {data: files} = await admin.storage
                            .from("instagram-media")
                            .list(`${acc.id}`);
                        for (const pid of toDelete) {
                            try {
                                // Remove storage files prefixed with `${pid}-`
                                const paths = (files || [])
                                    .filter((f: any) => f.name && f.name.startsWith(`${pid}-`))
                                    .map((f: any) => `${acc.id}/${f.name}`);
                                if (paths.length > 0) {
                                    await admin.storage.from("instagram-media").remove(paths);
                                }
                            } catch {
                            }
                            // Delete DB rows (media rows cascade)
                            await admin.from("instagram_posts").delete().eq("id", pid);
                            deleted += 1;
                        }
                    }
                }
            } catch {
            }
        }

        return NextResponse.json({
            ok: true,
            scope: isAdmin ? "all" : "current",
            result: {inserted, updated, deleted, downloaded: downloads, download_failed: downloadFailed}
        });
    } catch (e: any) {
        return NextResponse.json({error: e?.message || "Unexpected error"}, {status: 500});
    }
}







