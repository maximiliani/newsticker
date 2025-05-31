import { createClient } from '@/lib/supabase/server';
import { IgFeedClient } from './IgFeedClient';

export type IGPostData = {
    id: string;
    username: string;
    userAvatar: string;
    caption: string;
    location: string;
    postedAt: Date;
    media: any[];
};

// Server-side data fetching
async function getInstagramPosts(): Promise<{
    posts: IGPostData[];
    availableUsers: string[];
}> {
    const supabase = await createClient();

    try {
        const { data, error } = await supabase
            .from("instagram_posts")
            .select(`
                id,
                timestamp,
                posted_at,
                instagram_accounts:user_id (
                    username,
                    profile_image_url
                )
            `)
            .order("timestamp", { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            return { posts: [], availableUsers: [] };
        }

        if (!data) {
            return { posts: [], availableUsers: [] };
        }

        const mappedPosts: IGPostData[] = data.map((post: any) => ({
            id: post.id,
            username: post.instagram_accounts?.username || "Unknown",
            userAvatar: post.instagram_accounts?.profile_image_url || "",
            caption: "", // Omitted as caption isn't stored
            location: "", // Omitted as location isn't stored
            postedAt: new Date(post.timestamp),
            media: [], // Omitted as media isn't stored
        }));

        const uniqueUsers = Array.from(new Set(mappedPosts.map(post => post.username)));

        return {
            posts: mappedPosts,
            availableUsers: uniqueUsers
        };
    } catch (error) {
        console.error('Error fetching Instagram posts:', error);
        return { posts: [], availableUsers: [] };
    }
}

// Server Component
export default async function IgFeed() {
    const { posts, availableUsers } = await getInstagramPosts();

    if (posts.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <h2 className="text-xl font-bold">No instagram posts available.</h2>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Interactive header with filtering */}
            <IgFeedClient 
                initialPosts={posts}
                availableUsers={availableUsers}
            />
            
            {/* This will be replaced by the client component's filtered view */}
        </div>
    );
}