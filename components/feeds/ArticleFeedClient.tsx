"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { CreateArticleButton } from "@/components/CreateArticleButton";

// Removed initialArticles from props as it wasn't used in this component.
// If articles are displayed, it's likely by another component on the /news/manage page.
interface ArticleFeedClientProps {
    // No props needed if this component is self-contained for user and actions
}

export function ArticleFeedClient({}: ArticleFeedClientProps) {
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();
    
    // This callback is passed to CreateArticleButton.
    // It's responsible for refreshing data after an article is created.
    // The dialog closing should be handled within CreateArticleButton itself.
    const handleArticleCreated = useCallback(() => {
        router.refresh();
    }, [router]);

    useEffect(() => {
        const supabase = createClient();
        
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const supabase = createClient();
        
        // Listen for changes in the 'articles' table and refresh the page
        // to show the latest data. This is useful for a management page.
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

        return () => {
            supabase.removeChannel(articlesSubscription);
        };
    }, [router]);

    return (
        <div className="flex justify-between items-center p-4 border-b flex-shrink-0 relative">
            <h1 className="text-xl font-bold">Latest News</h1>
            {/* 
              The CreateArticleButton component likely handles its own dialog state.
              We pass the user object (for auth checks within the button/form)
              and a callback to refresh the page once an article is created.
            */}
            <CreateArticleButton 
                user={user}
                onArticleCreated={handleArticleCreated}
            />
        </div>
    );
}