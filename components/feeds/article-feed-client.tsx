"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { CreateArticleButton } from "@/features/articles/components/create-article-button";
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

    // Auto-refresh based on REFRESH_EVERY_MINUTES env variable
    useEffect(() => {
        const refreshMinutes = process.env.NEXT_PUBLIC_REFRESH_EVERY_MINUTES;

        if (refreshMinutes) {
            const minutes = parseInt(refreshMinutes, 10);
            if (!isNaN(minutes) && minutes > 0) {
                const intervalMs = minutes * 60 * 1000;
                const interval = setInterval(() => {
                    console.log(`Auto-refreshing article feed (every ${minutes} minutes)`);
                    router.refresh();
                }, intervalMs);

                return () => clearInterval(interval);
            }
        }
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
