"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { CreateArticleButton } from "@/features/articles/components/create-article-button";
import { createClient } from "@/lib/supabase/client";
import { NewsPreview } from "@/components/news-preview";
import { loadArticlePage } from "@/features/articles/services/feed-actions";
import { ARTICLE_PAGE_SIZE, FeedArticle } from "@/features/articles/services/feed-types";
import { eventDateKey, zonedLocalToIso } from "@/lib/utils/event-datetime";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Props {
    feedTitle: string;
    createTitle: string;
    emptyText: string;
    initialArticles: FeedArticle[];
    initialOffset: number;
    timezone: string;
    initialToday: string;
    from?: string;
    to?: string;
}

/**
 * Client side of the article feed: header, auto-refresh, realtime updates,
 * and infinite scrolling on top of the server-rendered first page.
 */
export function ArticleFeedClient({ feedTitle, createTitle, emptyText, initialArticles, initialOffset, timezone, initialToday, from, to }: Readonly<Props>) {
    const { user } = useAuth();
    const router = useRouter();
    const t = useTranslations("Articles");
    const [articles, setArticles] = useState(initialArticles);
    const [hasMore, setHasMore] = useState(initialArticles.length >= ARTICLE_PAGE_SIZE);
    const [offset, setOffset] = useState(initialOffset);
    const [endOffset, setEndOffset] = useState(initialOffset + initialArticles.length);
    const [today, setToday] = useState(initialToday);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<"earlier" | "later" | null>(null);
    const [focusComplete, setFocusComplete] = useState(false);
    const loadingRef = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);
    const topSpaceRef = useRef<HTMLDivElement>(null);
    const bottomSpaceRef = useRef<HTMLDivElement>(null);
    const focusPendingRef = useRef(true);
    const userScrolledRef = useRef(false);
    const prependHeightRef = useRef<number | null>(null);
    const generationRef = useRef(0);
    const rangeRef = useRef(`${from}|${to}`);

    // Reset to the fresh first page only when it actually changed, keeping loaded pages otherwise.
    const signature = initialArticles.map((a) => `${a.id}:${a.modifiedAt?.getTime()}:${a.sortAt.getTime()}`).join("|") + `|${from}|${to}|${initialOffset}`;
    const previousSignatureRef = useRef(signature);
    const focusedDayRef = useRef(today);
    useEffect(() => {
        if (previousSignatureRef.current === signature) return;
        previousSignatureRef.current = signature;
        generationRef.current++;
        const range = `${from}|${to}`;
        if (rangeRef.current !== range) {
            rangeRef.current = range;
            userScrolledRef.current = false;
        }
        focusPendingRef.current = !userScrolledRef.current;
        setFocusComplete(userScrolledRef.current);
        prependHeightRef.current = null;
        setArticles(initialArticles);
        setOffset(initialOffset);
        setEndOffset(initialOffset + initialArticles.length);
        setLoadError(null);
        setHasMore(initialArticles.length >= ARTICLE_PAGE_SIZE);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);

    useEffect(() => {
        const updateToday = () => setToday(eventDateKey(new Date(), timezone));
        updateToday();
        const timer = setInterval(updateToday, 60_000);
        return () => clearInterval(timer);
    }, [timezone]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") router.refresh();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [router]);

    useEffect(() => {
        const supabase = createClient();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const channel = supabase
            .channel('articles_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, () => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    if (document.visibilityState === "visible") router.refresh();
                }, 2000);
            })
            .subscribe();
        return () => {
            if (timer) clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [router]);

    const loadMore = useCallback(async (direction: "earlier" | "later") => {
        if (loadingRef.current || (direction === "later" ? !hasMore : offset === 0)) return;
        loadingRef.current = true;
        const generation = generationRef.current;
        setLoading(true);
        const nextOffset = direction === "earlier" ? Math.max(0, offset - ARTICLE_PAGE_SIZE) : endOffset;
        const limit = direction === "earlier" ? offset - nextOffset : ARTICLE_PAGE_SIZE;
        try {
            const next = await loadArticlePage(nextOffset, from, to, limit);
            if (generation !== generationRef.current) return;
            if (direction === "earlier" && scrollRef.current) {
                prependHeightRef.current = scrollRef.current.scrollHeight;
            }
            setArticles((prev) => {
                const seen = new Set(prev.map((a) => a.id));
                const fresh = next.filter((a) => !seen.has(a.id));
                return direction === "earlier" ? [...fresh, ...prev] : [...prev, ...fresh];
            });
            if (direction === "earlier") setOffset(nextOffset);
            else {
                setEndOffset(nextOffset + next.length);
                setHasMore(next.length >= ARTICLE_PAGE_SIZE);
            }
        } catch (error) {
            if (generation !== generationRef.current) return;
            console.error("Failed to load more articles:", error);
            toast.error(t("loadMoreError"));
            setLoadError(direction);
            focusPendingRef.current = false;
            setFocusComplete(true);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [endOffset, offset, hasMore, from, to, t]);

    useEffect(() => {
        const root = scrollRef.current;
        const top = topSentinelRef.current;
        const bottom = bottomSentinelRef.current;
        if (!root) return;
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                if (loading || loadError) continue;
                if (entry.target === top && focusComplete) void loadMore("earlier");
                if (entry.target === bottom) void loadMore("later");
            }
        }, { root, rootMargin: "300px" });
        if (top && offset > 0) observer.observe(top);
        if (bottom && hasMore) observer.observe(bottom);
        return () => observer.disconnect();
    }, [loadMore, hasMore, offset, focusComplete, loading, loadError]);

    // Load through the end of today so all of today's events can be positioned together.
    const tomorrow = new Date(`${today}T00:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowKey = tomorrow.toISOString().slice(0, 10);
    const localEnd = zonedLocalToIso(`${tomorrowKey}T00:00`, timezone)!;
    const todayEnd = Math.max(new Date(localEnd).getTime(), tomorrow.getTime());
    const focusReady = !hasMore || (articles.length > 0 && articles[articles.length - 1].sortAt.getTime() >= todayEnd);

    useEffect(() => {
        if (focusPendingRef.current && !focusReady && !loading && !loadError) void loadMore("later");
    }, [focusReady, loadMore, loading, loadError]);

    useLayoutEffect(() => {
        const root = scrollRef.current;
        if (!root) return;
        if (focusedDayRef.current !== today) {
            focusedDayRef.current = today;
            if (!userScrolledRef.current) {
                focusPendingRef.current = true;
                setFocusComplete(false);
            }
        }
        if (prependHeightRef.current !== null) {
            root.scrollTop += root.scrollHeight - prependHeightRef.current;
            prependHeightRef.current = null;
        }
        const centerToday = () => {
            const topSpace = topSpaceRef.current;
            const bottomSpace = bottomSpaceRef.current;
            if (!focusReady || !articles.length || !root.clientHeight || !topSpace || !bottomSpace) return;
            const items = Array.from(root.querySelectorAll<HTMLElement>("[data-article-id]"));
            const todayIndexes = articles.flatMap((article, index) =>
                article.eventDatetime && eventDateKey(article.eventDatetime, timezone, article.eventAllDay) === today ? [index] : []);
            const firstFuture = articles.findIndex((article) =>
                eventDateKey(article.sortAt, timezone, article.eventAllDay && !!article.eventDatetime) >= today);
            const first = todayIndexes[0] ?? (firstFuture >= 0 ? firstFuture : articles.length - 1);
            const last = todayIndexes[todayIndexes.length - 1] ?? first;

            topSpace.style.height = "0px";
            bottomSpace.style.height = "0px";
            const rootTop = root.getBoundingClientRect().top + root.clientTop;
            const firstTop = items[first].getBoundingClientRect().top - rootTop + root.scrollTop;
            const lastBottom = items[last].getBoundingClientRect().bottom - rootTop + root.scrollTop;
            const target = lastBottom - firstTop <= root.clientHeight
                ? (firstTop + lastBottom - root.clientHeight) / 2
                : firstTop - 16;
            const topSpaceHeight = Math.max(0, -target);
            const contentBottom = bottomSpace.getBoundingClientRect().top - rootTop + root.scrollTop
                + parseFloat(getComputedStyle(root).paddingBottom);
            const bottomSpaceHeight = Math.max(0, target + root.clientHeight - contentBottom);
            topSpace.style.height = `${topSpaceHeight}px`;
            bottomSpace.style.height = `${bottomSpaceHeight}px`;
            root.scrollTop = target + topSpaceHeight;
            focusPendingRef.current = false;
            setFocusComplete(true);
        };

        if (focusPendingRef.current) centerToday();
        let width = root.clientWidth;
        let height = root.clientHeight;
        const observer = new ResizeObserver(() => {
            if (width === root.clientWidth && height === root.clientHeight) return;
            width = root.clientWidth;
            height = root.clientHeight;
            if (!userScrolledRef.current) centerToday();
        });
        observer.observe(root);
        return () => observer.disconnect();
    }, [articles, focusReady, timezone, today]);

    const stopFollowingToday = () => {
        userScrolledRef.current = true;
        focusPendingRef.current = false;
        setFocusComplete(true);
    };

    return (
        <div className="h-full flex flex-col overflow-hidden min-w-0">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0 relative">
                <h1 className="text-xl font-bold">{feedTitle}</h1>
                <CreateArticleButton user={user} title={createTitle} />
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 [overflow-anchor:none]"
                onWheel={stopFollowingToday}
                onTouchMove={stopFollowingToday}
                onKeyDown={stopFollowingToday}
                onPointerDown={(event) => { if (event.target === event.currentTarget) stopFollowingToday(); }}
                tabIndex={0} aria-label={feedTitle}>
                {articles.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">{emptyText}</p>
                    </div>
                ) : (
                    <>
                        <div ref={topSpaceRef} aria-hidden="true" />
                        <div className="flex flex-col gap-4">
                            {offset > 0 && <div ref={topSentinelRef} className="h-1" />}
                            {loadError === "earlier" && (
                                <button type="button" className="text-sm text-primary underline" onClick={() => { setLoadError(null); void loadMore("earlier"); }}>
                                    {t("retryLoad")}
                                </button>
                            )}
                            {articles.map((newsItem) => (
                                <Link key={newsItem.id} data-article-id={newsItem.id} href={`/news/${newsItem.id}`} prefetch={false} className="block cursor-pointer">
                                    <NewsPreview news={newsItem} timezone={timezone} isToday={!!newsItem.eventDatetime && eventDateKey(newsItem.eventDatetime, timezone, newsItem.eventAllDay) === today} />
                                </Link>
                            ))}
                            {hasMore && <div ref={bottomSentinelRef} className="h-8" />}
                            {loadError === "later" && (
                                <button type="button" className="text-sm text-primary underline" onClick={() => { setLoadError(null); void loadMore("later"); }}>
                                    {t("retryLoad")}
                                </button>
                            )}
                        </div>
                        <div ref={bottomSpaceRef} aria-hidden="true" />
                    </>
                )}
            </div>
        </div>
    );
}
