"use client";

import { IGPost, IGPostData } from "@/features/instagram/components/instagram-post";
import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRouter } from 'next/navigation';

interface IgFeedClientProps {
    initialPosts: IGPostData[];
    availableUsers: string[];
}

export function IgFeedClient({ initialPosts, availableUsers }: IgFeedClientProps) {
    const [posts, setPosts] = useState<IGPostData[]>(initialPosts);
    const [users, setUsers] = useState<string[]>(availableUsers);
    const [activeUsers, setActiveUsers] = useState<string[]>(["all"]);
    const router = useRouter();

    // Memoize filtered posts
    const activePosts = useMemo(() => {
        if (activeUsers.includes("all")) return posts;
        return posts.filter((post) => activeUsers.includes(post.username));
    }, [posts, activeUsers]);

    const areAllUsersSelected = activeUsers.length === users.length;

    const refreshData = useCallback(() => {
        router.refresh();
    }, [router]);

    // Update local state when server data changes
    useEffect(() => {
        setPosts(initialPosts);
        setUsers(availableUsers);
    }, [initialPosts, availableUsers]);

    // Auto-refresh based on REFRESH_EVERY_MINUTES env variable
    useEffect(() => {
        const refreshMinutes = process.env.NEXT_PUBLIC_REFRESH_EVERY_MINUTES;

        if (refreshMinutes) {
            const minutes = parseInt(refreshMinutes, 10);
            if (!isNaN(minutes) && minutes > 0) {
                const intervalMs = minutes * 60 * 1000;
                const interval = setInterval(() => {
                    console.log(`Auto-refreshing Instagram feed (every ${minutes} minutes)`);
                    refreshData();
                }, intervalMs);

                return () => clearInterval(interval);
            }
        }
    }, [refreshData]);

    useEffect(() => {
        const supabase = createClient();

        // Set up real-time subscription for instagram_posts
        const subscription = supabase
            .channel('instagram_posts_changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'instagram_posts'
                },
                (payload) => {
                    console.log('Instagram posts change received:', payload);
                    refreshData();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'instagram_accounts'
                },
                (payload) => {
                    console.log('Instagram accounts change received:', payload);
                    refreshData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [refreshData]);

    return (
        <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
            {/* Header with filtering */}
            <div className="items-center p-4 border-b relative">
                <h1 className="text-xl font-bold">Instagram Feed</h1>
                <div className="items-center">
                    {/* Instagram account picker */}
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
                                    setActiveUsers([...users]);
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
                        {users.map((username) => (
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
            </div>

            {/* Posts Container */}
            <div className="flex-1 overflow-y-auto min-w-0">
                <div 
                    className="grid auto-rows-max gap-2 p-2"
                    style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))" }}
                >
                    {activePosts.map((post) => (
                        <div className="max-h-96 h-96 w-full" key={post.id}>
                            <IGPost postId={post.id} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}