import {serve} from "https://deno.land/std@0.177.0/http/server.ts";
import {createClient, SupabaseClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

interface InstagramAccount {
    user_id: string;
    username: string;
    access_token: string;
}

interface InstagramMedia {
    id: string;
    caption?: string;
    media_type: string;
    media_url: string;
    thumbnail_url?: string;
    timestamp: string;
    children?: {
        data: InstagramMedia[];
    };
}

// Helper: Download image/video blob then upload to Supabase storage, returning public URL
async function downloadAndUploadMedia(
    supabase: SupabaseClient,
    url: string,
    storageBucket: string,
    storagePath: string,
): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download media: ${url}`);
    }
    const data = await response.arrayBuffer();
    const buffer = new Uint8Array(data);

    const {error} = await supabase.storage.from(storageBucket).upload(storagePath, buffer, {
        upsert: true,
    });

    if (error) {
        throw new Error(`Failed to upload media to storage: ${error.message}`);
    }

    const publicUrl = supabase.storage.from(storageBucket).getPublicUrl(storagePath).data.publicUrl;
    return publicUrl;
}

serve(async (req: Request) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", {status: 405});
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const storageBucket = Deno.env.get("SUPABASE_STORAGE_BUCKET") || "instagram-media";

    try {
        // Fetch all Instagram accounts to update posts for
        const {data: igAccounts, error: accountsError} = await supabase
            .from<InstagramAccount>("instagram_accounts")
            .select("user_id, username, access_token");

        if (accountsError) {
            console.error("Error fetching instagram_accounts:", accountsError);
            return new Response(
                JSON.stringify({error: "Failed to fetch Instagram accounts"}),
                {status: 500, headers: {"Content-Type": "application/json"}},
            );
        }

        if (!igAccounts || igAccounts.length === 0) {
            return new Response(
                JSON.stringify({message: "No Instagram accounts found"}),
                {status: 200, headers: {"Content-Type": "application/json"}},
            );
        }

        // For each account, fetch posts using Instagram Graph API and store them + media
        for (const account of igAccounts) {
            const {user_id, username, access_token} = account;

            // Fetch media from Instagram Graph API (pagination can be handled in extended implementation)
            let nextUrl = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,children{media_type,media_url,thumbnail_url}&access_token=${access_token}`;

            while (nextUrl) {
                const response = await fetch(nextUrl);
                if (!response.ok) {
                    console.error(`Failed to fetch media for ${username}:`, await response.text());
                    break;
                }

                const json = await response.json();

                if (!json.data) {
                    console.error(`No media data for ${username}`);
                    break;
                }

                for (const post of json.data as InstagramMedia[]) {
                    // Check if post exists in DB by instagram_post_id
                    const {data: existingPosts} = await supabase
                        .from("instagram_posts")
                        .select("id")
                        .eq("instagram_post_id", post.id)
                        .maybeSingle();

                    if (existingPosts) {
                        // Post already exists, skip or optionally update
                        continue;
                    }

                    // Download and upload main media
                    let mainMediaPublicUrl = "";
                    try {
                        mainMediaPublicUrl = await downloadAndUploadMedia(
                            supabase,
                            post.media_url,
                            storageBucket,
                            `posts/${user_id}/${post.id}/${encodeURIComponent(post.media_url.split("/").pop() || "media")}`,
                        );
                    } catch (err) {
                        console.error("Failed to upload main media:", err);
                        // Continue even if media upload fails
                    }

                    // Insert post record
                    const {data: insertedPost, error: postInsertError} = await supabase
                        .from("instagram_posts")
                        .insert({
                            instagram_user_id: user_id,
                            instagram_post_id: post.id,
                            caption: post.caption || null,
                            media_type: post.media_type,
                            media_url: mainMediaPublicUrl,
                            timestamp: post.timestamp,
                        })
                        .select()
                        .single();

                    if (postInsertError || !insertedPost) {
                        console.error("Failed to insert post record:", postInsertError);
                        continue;
                    }

                    const postId = insertedPost.id;

                    // Insert child media if exists (e.g. carousel)
                    if (post.children && post.children.data.length > 0) {
                        for (let i = 0; i < post.children.data.length; i++) {
                            const child = post.children.data[i];
                            let childMediaPublicUrl = "";
                            try {
                                childMediaPublicUrl = await downloadAndUploadMedia(
                                    supabase,
                                    child.media_url,
                                    storageBucket,
                                    `posts/${user_id}/${post.id}/children/${i}_${encodeURIComponent(child.media_url.split("/").pop() || "media")}`,
                                );
                            } catch (err) {
                                console.error("Failed to upload child media:", err);
                                continue;
                            }

                            const {error: mediaInsertError} = await supabase.from("instagram_post_media").insert({
                                instagram_post_id: postId,
                                media_type: child.media_type,
                                media_url: childMediaPublicUrl,
                                thumbnail_url: child.thumbnail_url || null,
                                order_index: i,
                            });

                            if (mediaInsertError) {
                                console.error("Failed to insert child media record:", mediaInsertError);
                            }
                        }
                    }
                }

                // Check for pagination next page
                nextUrl = json.paging?.next || null;
            }
        }

        return new Response(
            JSON.stringify({message: "Instagram posts fetched and stored successfully"}),
            {status: 200, headers: {"Content-Type": "application/json"}},
        );
    } catch (error) {
        console.error("Unexpected error:", error);
        return new Response(
            JSON.stringify({error: "Internal server error"}),
            {status: 500, headers: {"Content-Type": "application/json"}},
        );
    }
});
