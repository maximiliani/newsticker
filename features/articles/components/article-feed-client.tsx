"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { CreateArticleButton } from "./create-article-button";
import { createClient } from "@/lib/supabase/client";

/**
 * Client component for the article feed header
 * Shows the latest news title and create button
 */
export function ArticleFeedClient() {
    const { user } = useAuth();
    const router = useRouter();

    // Refresh page data when an article is created
    const handleArticleCreated = useCallback(() => {
        router.refresh();
    }, [router]);

    // Set up realtime subscription for article changes
    useEffect(() => {
        const supabase = createClient();

        // Subscribe to all article changes to keep the feed up-to-date
        const articlesSubscription = supabase
            .channel('articles_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'articles'
            }, () => {
                router.refresh();
            })
            .subscribe();

        // Clean up subscription when component unmounts
        return () => {
            supabase.removeChannel(articlesSubscription);
        };
    }, [router]);

    return (
        <div className="flex justify-between items-center p-4 border-b flex-shrink-0 relative">
            <h1 className="text-xl font-bold">Latest News</h1>
            <CreateArticleButton 
                user={user}
                onArticleCreated={handleArticleCreated}
            />
        </div>
    );
}
