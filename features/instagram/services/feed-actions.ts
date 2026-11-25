"use server";

import { createClient } from "@/lib/supabase/server";
import type { IGPostData } from "@/features/instagram/components/instagram-post";
import { z } from "zod";
import { INSTAGRAM_PAGE_SIZE, type InstagramFeedCursor, type InstagramFeedPage } from "./feed-types";

const feedRows = z.array(z.object({
    id: z.string().regex(/^\d+$/),
    timestamp: z.number(),
    posted_at: z.string().nullable(),
    caption: z.string().nullable(),
    instagram_accounts: z.object({ username: z.string(), profile_image_url: z.string().nullable() }),
    instagram_post_media: z.array(z.object({
        index: z.number(),
        media_type: z.enum(["image", "video"]),
        media_url: z.string(),
        thumbnail_url: z.string().nullable(),
        local_media_url: z.string().nullable(),
        local_thumbnail_url: z.string().nullable(),
        download_status: z.string().nullable(),
    })),
}));

export async function loadInstagramAccounts(): Promise<string[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("public_instagram_accounts")
        .select("username").order("username");
    if (error) {
        console.error("Failed to load Instagram accounts:", error);
        throw new Error("Failed to load Instagram accounts");
    }
    return (data ?? []).map((account) => account.username).filter(Boolean);
}

export async function loadInstagramPage(cursor: InstagramFeedCursor | null = null, users: string[] = []): Promise<InstagramFeedPage> {
    if ((cursor && (!Number.isSafeInteger(cursor.timestamp) || cursor.timestamp < 0 ||
        typeof cursor.id !== "string" || !/^\d{1,19}$/.test(cursor.id))) || users.length > 100 ||
        users.some((name) => typeof name !== "string" || name.length > 100)) {
        throw new Error("Invalid Instagram page request");
    }
    const supabase = await createClient();
    let query = supabase.from("instagram_posts").select(`
        id:id::text, timestamp, posted_at, caption,
        instagram_accounts!inner(username, profile_image_url),
        instagram_post_media(index, media_type, media_url, thumbnail_url,
            local_media_url, local_thumbnail_url, download_status)
    `);
    if (users.length) query = query.in("instagram_accounts.username", users);
    if (cursor) query = query.or(`timestamp.lt.${cursor.timestamp},and(timestamp.eq.${cursor.timestamp},id.lt.${cursor.id})`);
    const { data, error } = await query
        .order("timestamp", { ascending: false })
        .order("id", { ascending: false })
        .limit(INSTAGRAM_PAGE_SIZE + 1);
    if (error) {
        console.error("Failed to load Instagram posts:", error);
        throw new Error("Failed to load Instagram posts");
    }
    const rows = feedRows.parse(data ?? []);
    const posts: IGPostData[] = rows.slice(0, INSTAGRAM_PAGE_SIZE).map((row) => ({
        id: row.id,
        username: row.instagram_accounts.username,
        userAvatar: row.instagram_accounts.profile_image_url ?? "",
        caption: row.caption ?? undefined,
        postedAt: row.posted_at ? new Date(row.posted_at) : new Date(row.timestamp * 1000),
        media: [...row.instagram_post_media].sort((a, b) => a.index - b.index).map((media) => ({
            type: media.media_type,
            url: media.local_media_url && media.download_status === "completed" ? media.local_media_url : media.media_url,
            media_url: media.media_url,
            thumbnail_url: media.thumbnail_url,
            local_media_url: media.local_media_url,
            local_thumbnail_url: media.local_thumbnail_url,
            download_status: media.download_status ?? undefined,
        })),
    }));
    const last = rows[Math.min(rows.length, INSTAGRAM_PAGE_SIZE) - 1];
    return {
        posts,
        hasMore: rows.length > INSTAGRAM_PAGE_SIZE,
        nextCursor: last ? { timestamp: last.timestamp, id: last.id } : null,
    };
}
