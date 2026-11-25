"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { CreateArticleButton } from "@/features/articles/components/create-article-button";
import { createClient } from "@/lib/supabase/client";
import { NewsPreview } from "@/components/news-preview";
import { loadArticlePage } from "@/features/articles/services/feed-actions";
import { ARTICLE_PAGE_SIZE, FeedArticle } from "@/features/articles/services/feed-types";

interface Props {
    feedTitle: string;
    createTitle: string;
    emptyText: string;
    initialArticles: FeedArticle[];
    from?: string;
    to?: string;
}

/**
 * Client side of the article feed: header, auto-refresh, realtime updates,
 * and infinite scrolling on top of the server-rendered first page.
 */
export function ArticleFeedClient({ feedTitle, createTitle, emptyText, initialArticles, from, to }: Readonly<Props>) {
    const { user } = useAuth();
    const router = useRouter();
    const [articles, setArticles] = useState(initialArticles);
    const [hasMore, setHasMore] = useState(initialArticles.length >= ARTICLE_PAGE_SIZE);
    const loadingRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Reset to the fresh first page only when it actually changed, keeping loaded pages otherwise.
    const signature = initialArticles.map((a) => `${a.id}:${a.modifiedAt?.getTime()}`).join("|") + `|${from}|${to}`;
    useEffect(() => {
        setArticles(initialArticles);
        setHasMore(initialArticles.length >= ARTICLE_PAGE_SIZE);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);

    const handleArticleCreated = useCallback(() => router.refresh(), [router]);

    useEffect(() => {
        const interval = setInterval(() => router.refresh(), 30 * 1000);
        return () => clearInterval(interval);
    }, [router]);

    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('articles_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, () => router.refresh())
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [router]);

    const loadMore = useCallback(async () => {
        if (loadingRef.current || !hasMore) return;
        loadingRef.current = true;
        try {
            const next = await loadArticlePage(articles.length, from, to);
            setArticles((prev) => {
                const seen = new Set(prev.map((a) => a.id));
                return [...prev, ...next.filter((a) => !seen.has(a.id))];
            });
            setHasMore(next.length >= ARTICLE_PAGE_SIZE);
        } finally {
            loadingRef.current = false;
        }
    }, [articles.length, hasMore, from, to]);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el || !hasMore) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) void loadMore();
        }, { rootMargin: "300px" });
        observer.observe(el);
        return () => observer.disconnect();
    }, [loadMore, hasMore]);

    return (
        <div className="h-full flex flex-col overflow-hidden min-w-0">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0 relative">
                <h1 className="text-xl font-bold">{feedTitle}</h1>
                <CreateArticleButton user={user} title={createTitle} />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {articles.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">{emptyText}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {articles.map((newsItem) => (
                            <Link key={newsItem.id} href={`/news/${newsItem.id}`} className="block cursor-pointer">
                                <NewsPreview news={newsItem} />
                            </Link>
                        ))}
                        {hasMore && <div ref={sentinelRef} className="h-8" />}
                    </div>
                )}
            </div>
        </div>
    );
}
