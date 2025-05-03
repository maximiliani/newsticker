"use client";
import { IGPost, IGPostData } from "@/components/ig-post";
import { useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {createClient} from "@/lib/supabase/client";
// import { createClient } from "@supabase/supabase-js";

// // Create Supabase client (replace your env variables accordingly)
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// const supabase = createClient(supabaseUrl, supabaseKey);

export default function IgFeed() {
    const supabase = createClient()
    const [availableUsers, setAvailableUsers] = useState<string[]>([]);
    const [activeUsers, setActiveUsers] = useState<string[]>(["all"]);
    const [activePosts, setActivePosts] = useState<IGPostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch posts from Supabase
    useEffect(() => {
        async function fetchPosts() {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from("instagram_posts")
                .select(`
                    id,
                    instagram_post_id,
                    caption,
                    media_type,
                    media_url,
                    timestamp,
                    instagram_accounts:instagram_user_id (
                        username,
                        profile_image_url
                    ),
                    instagram_post_media:instagram_post_id (
                        media_type,
                        media_url,
                        thumbnail_url
                    )
                `)
                .order("timestamp", { ascending: false });

            if (error) {
                setError(error.message);
                setLoading(false);
                return;
            }

            if (!data) {
                setActivePosts([]);
                setLoading(false);
                return;
            }

            // Map the data to IGPostData format
            const mappedPosts: IGPostData[] = data.map((post: any) => {
                const mainMedia = {
                    type: post.media_type === "VIDEO" ? "video" : "image",
                    url: post.media_url,
                };

                const childrenMedia = (post.instagram_post_media || []).map((m: any) => ({
                    type: m.media_type === "VIDEO" ? "video" : "image",
                    url: m.media_url,
                }));

                const media = mainMedia ? [mainMedia, ...childrenMedia] : childrenMedia;

                return {
                    id: post.instagram_post_id,
                    username: post.instagram_accounts?.username || "Unknown",
                    userAvatar: post.instagram_accounts?.profile_image_url || "",
                    caption: post.caption || undefined,
                    location: undefined, // Omitted as location isn't stored
                    postedAt: new Date(post.timestamp),
                    media,
                };
            });

            setActivePosts(mappedPosts);
            setAvailableUsers(Array.from(new Set(mappedPosts.map(post => post.username))));
            setLoading(false);
        }

        fetchPosts();
    }, []);

    useEffect(() => {
        setActiveUsers(["all", ...availableUsers]);
    }, [availableUsers]);

    useEffect(() => {
        setActivePosts(activePosts.filter((post) => activeUsers.includes(post.username)));
    }, [activeUsers]);

    const areAllUsersSelected = activeUsers.length === availableUsers.length;

    if (loading) {
        return <p>Loading posts...</p>;
    }
    if (error) {
        return <p>Error loading posts: {error}</p>;
    }

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-xl font-bold">Instagram Feed</h2>

            {/* User Selector */}
            <div className="justify-center items-center my-4">
                <ToggleGroup 
                    variant="outline" 
                    type="multiple"
                    orientation="horizontal"
                    value={activeUsers}
                    onValueChange={(value) => {
                        if (value.includes("all")) {
                            if (areAllUsersSelected) {
                                setActiveUsers([]);
                            } else {
                                setActiveUsers([...availableUsers]);
                            }
                        } else {
                            setActiveUsers(value);
                        }
                    }}
                    className="flex flex-wrap gap-2"
                >
                    <ToggleGroupItem 
                        key="all" 
                        value="all" 
                        aria-label="All"
                        defaultChecked
                        className="hover:bg-primary hover:text-primary-foreground"
                        data-state={areAllUsersSelected ? "on" : "off"}
                    >
                        All
                    </ToggleGroupItem>
                    {availableUsers.map((username) => (
                        <ToggleGroupItem
                            key={username}
                            value={username}
                            aria-label={username}
                            className="hover:bg-primary hover:text-primary-foreground"
                            data-state={activeUsers.includes(username) ? "on" : "off"}
                        >
                            {username}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>

            {/* Posts Container */}
            <div className="flex-1 overflow-y-auto">
                <div className="grid auto-rows-max grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4 p-2 place-items-center">
                    {activePosts.map((post) => (
                        <div className="w-64" key={post.id}>
                            <IGPost post={post} />
                        </div>
                    ))}
                </div>
            </div>
            
        </div>
    )
}

