"use client";
import {IGPost, IGPostData} from "@/components/ig-post";
import {useEffect, useMemo, useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group";

export default function IgFeed() {
    const supabase = createClient();
    const [availableUsers, setAvailableUsers] = useState<string[]>([]);
    const [activeUsers, setActiveUsers] = useState<string[]>(["all"]);
    const [posts, setPosts] = useState<IGPostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Memoize filtered posts
    const activePosts = useMemo(() => {
        if (activeUsers.includes("all")) return posts;
        return posts.filter((post) => activeUsers.includes(post.username));
    }, [posts, activeUsers]);

    useEffect(() => {
        let isMounted = true;

        function mapPostData(post: any): IGPostData {
            // const mainMedia = {
            //     type: post.media_type === "VIDEO" ? "video" : "image",
            //     url: post.media_url,
            // };
            //
            // const childrenMedia = (post.instagram_post_media || []).map((m: any) => ({
            //     type: m.media_type === "VIDEO" ? "video" : "image",
            //     url: m.media_url,
            // }));
            //
            // const media = mainMedia ? [mainMedia, ...childrenMedia] : childrenMedia;

            return {
                id: post.id,
                username: post.instagram_accounts?.username || "Unknown",
                userAvatar: post.instagram_accounts?.profile_image_url || "",
                caption: "", // Omitted as caption isn't stored
                location: "", // Omitted as location isn't stored
                postedAt: new Date(post.timestamp),
                media: [], // Omitted as media isn't stored
            }
        }

        async function fetchPosts() {
            setLoading(true);
            setError(null);

            try {
                const {data, error} = await supabase
                    .from("instagram_posts")
                    .select(`
                    id,
                    timestamp,
                    instagram_accounts:instagram_user_id (
                        username,
                        profile_image_url
                    )
                    `)
                    .order("timestamp", {ascending: false});

                if (!isMounted) return;

                if (error) throw error;
                if (!data) {
                    setPosts([]);
                    return;
                }

                const mappedPosts = data.map(mapPostData);
                setPosts(mappedPosts);

                const uniqueUsers = Array.from(new Set(mappedPosts.map(post => post.username)));
                setAvailableUsers(uniqueUsers);
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'An unknown error occurred');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        fetchPosts();

        return () => {
            isMounted = false;
        };
    }, []);

    const areAllUsersSelected = activeUsers.length === availableUsers.length;

    if (loading) {
        return <p>Loading posts...</p>;
    }
    if (error) {
        return <p>Error loading posts: {error}</p>;
    }

    if (posts.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <h2 className="text-xl font-bold">No instagram posts available.</h2>
            </div>
        )
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
                <div
                    className="grid auto-rows-max grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4 p-2 place-items-center">
                    {activePosts.map((post) => (
                        <div className="w-64" key={post.id}>
                            <IGPost postId={post.id}/>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    )
}

