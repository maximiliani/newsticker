"use client";

import { IGPost } from "@/features/instagram/components/instagram-post";
import { loadInstagramPage } from "@/features/instagram/services/feed-actions";
import type { InstagramFeedPage } from "@/features/instagram/services/feed-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import RefreshInstagramFeedsButton from "@/features/instagram/components/refresh-instagram-feeds-button";

interface IgFeedClientProps {
    initialPage: InstagramFeedPage;
    availableUsers: string[];
}

export function IgFeedClient({ initialPage, availableUsers }: IgFeedClientProps) {
    const t = useTranslations("Instagram");
    const router = useRouter();
    const [page, setPage] = useState(initialPage);
    const [selected, setSelected] = useState<string[]>([]);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [retry, setRetry] = useState(0);
    const sentinel = useRef<HTMLDivElement>(null);
    const scrollRoot = useRef<HTMLDivElement>(null);
    const requestId = useRef(0);
    const loadingRef = useRef(false);
    const selectionKey = selected.join("\0");

    useEffect(() => {
        if (selectionKey) return;
        requestId.current++;
        loadingRef.current = false;
        setLoading(false);
        setError(false);
        setPage(initialPage);
    }, [initialPage, selectionKey]);

    useEffect(() => {
        if (!selectionKey) return;
        const id = ++requestId.current;
        loadingRef.current = true;
        setLoading(true);
        setError(false);
        loadInstagramPage(null, selectionKey.split("\0"))
            .then((result) => { if (id === requestId.current) setPage(result); })
            .catch((err) => {
                console.error("Failed to filter Instagram feed:", err);
                if (id === requestId.current) setError(true);
            })
            .finally(() => {
                if (id === requestId.current) {
                    loadingRef.current = false;
                    setLoading(false);
                }
            });
        return () => { requestId.current++; };
    }, [selectionKey, initialPage, retry]);

    const loadMore = useCallback(async () => {
        if (loadingRef.current || !page.hasMore || error) return;
        loadingRef.current = true;
        setLoading(true);
        const id = requestId.current;
        try {
            const next = await loadInstagramPage(page.nextCursor, selected);
            if (id !== requestId.current) return;
            setPage((previous) => {
                const seen = new Set(previous.posts.map((post) => post.id));
                return { posts: [...previous.posts, ...next.posts.filter((post) => !seen.has(post.id))], hasMore: next.hasMore, nextCursor: next.nextCursor };
            });
        } catch (err) {
            console.error("Failed to load more Instagram posts:", err);
            if (id === requestId.current) setError(true);
        } finally {
            if (id === requestId.current) {
                loadingRef.current = false;
                setLoading(false);
            }
        }
    }, [page.hasMore, page.nextCursor, selected, error]);

    useEffect(() => {
        const el = sentinel.current;
        if (!el || !page.hasMore || error) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) void loadMore();
        }, { root: scrollRoot.current, rootMargin: "300px" });
        observer.observe(el);
        return () => observer.disconnect();
    }, [loadMore, page.hasMore, error]);

    useEffect(() => {
        const supabase = createClient();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const refresh = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                if (document.visibilityState === "visible") router.refresh();
            }, 2000);
        };
        const channel = supabase.channel("instagram_posts_changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "instagram_posts" }, refresh)
            .on("postgres_changes", { event: "*", schema: "public", table: "instagram_post_media" }, refresh)
            .on("postgres_changes", { event: "*", schema: "public", table: "instagram_accounts" }, refresh)
            .subscribe();
        return () => {
            if (timer) clearTimeout(timer);
            void supabase.removeChannel(channel);
        };
    }, [router]);

    return (
        <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0 relative">
                <h1 className="text-xl font-bold">{t("feedTitle")}</h1>
                <ToggleGroup variant="outline" type="multiple" orientation="horizontal"
                    value={selected.length ? selected : ["all"]}
                    onValueChange={(value) => {
                        if (value.includes("all") && selected.length) setSelected([]);
                        else if (value.includes("all")) setSelected(value.filter((item) => item !== "all"));
                        else setSelected(value);
                    }} className="flex flex-wrap gap-2">
                    <ToggleGroupItem value="all" aria-label={t("all")}>{t("all")}</ToggleGroupItem>
                    {availableUsers.map((username) => (
                        <ToggleGroupItem key={username} value={username} aria-label={username}>
                            {username}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                <RefreshInstagramFeedsButton />
            </div>
            <div ref={scrollRoot} className="flex-1 overflow-y-auto min-w-0">
                {!loading && !error && page.posts.length === 0 && <p className="p-4">{t("noPosts")}</p>}
                <div className="grid auto-rows-max gap-2 p-2"
                    style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))" }}>
                    {page.posts.map((post) => (
                        <div className="max-h-96 h-96 w-full" key={post.id}>
                            <IGPost post={post} />
                        </div>
                    ))}
                </div>
                {page.hasMore && <div ref={sentinel} className="h-8" />}
                {error && <div className="p-2" role="alert">
                    <p>{t("loadError")}</p>
                    <Button variant="outline" onClick={() => { setError(false); if (selected.length) setRetry((value) => value + 1); else router.refresh(); }}>
                        {t("retry")}
                    </Button>
                </div>}
            </div>
        </div>
    );
}
