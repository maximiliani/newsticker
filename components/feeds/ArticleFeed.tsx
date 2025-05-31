"use client";

import {NewsPreview} from "@/components/news-preview";
import {Button} from "@/components/ui/button";
import {PlusIcon} from "@radix-ui/react-icons";
import {useEffect, useState, useCallback} from 'react';
import {createClient} from '@/lib/supabase/client';
import Link from 'next/link';
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";
import {CreateArticleForm} from "@/components/CreateArticleForm";

// Type for data structure from the 'articles_with_author_info' view
type ArticleFromView = {
    id: string;
    title: string;
    description: string;
    created_at: string;
    modified_at: string;
    visibility_from: string;
    visibility_to: string | null; // visibility_to can be null
    author_name: string | null;
    author_avatar: string | null;
};

// Type expected by the NewsPreview component
type NewsPreviewInputData = {
    id: string;
    title: string;
    description: string;
    createdAt: Date;
    modifiedAt?: Date;
    visibilityFrom: Date;
    visibilityTo: Date | null;
    author: {
        name: string;
        avatar?: string;
    };
};

export default function ArticleFeed() {
    const [newsItems, setNewsItems] = useState<NewsPreviewInputData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    // Filter articles based on current visibility
    const getVisibleArticles = useCallback((articles: NewsPreviewInputData[]) => {
        const now = new Date();
        return articles.filter(
            (newsItem) => {
                return now >= newsItem.visibilityFrom && (!newsItem.visibilityTo || now <= newsItem.visibilityTo);
            }
        );
    }, []);

    const fetchNews = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const supabase = createClient();
            
            // Add a small delay to ensure client is properly initialized
            await new Promise(resolve => setTimeout(resolve, 100));

            const {data, error: fetchError} = await supabase
                .from('articles_with_author_info')
                .select('id, title, description, created_at, modified_at, visibility_from, visibility_to, author_name, author_avatar')
                .order('created_at', {ascending: false});

            if (fetchError) {
                console.error('Supabase error details:', fetchError);
                throw new Error(`Database error: ${fetchError.message || 'Unknown error'}`);
            }

            if (data) {
                const transformedData: NewsPreviewInputData[] = data.map((article: ArticleFromView) => ({
                    id: article.id,
                    title: article.title,
                    description: article.description,
                    createdAt: new Date(article.created_at),
                    modifiedAt: new Date(article.modified_at),
                    visibilityFrom: new Date(article.visibility_from),
                    visibilityTo: article.visibility_to ? new Date(article.visibility_to) : null,
                    author: {
                        name: article.author_name || 'Anonymous',
                        avatar: article.author_avatar || undefined,
                    },
                }));
                setNewsItems(transformedData);
            } else {
                setNewsItems([]);
            }
        } catch (err) {
            console.error('Error in fetchNews:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch articles';
            setError(errorMessage);
            setNewsItems([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        let subscription: any = null;
        let visibilityTimer: NodeJS.Timeout | null = null;

        // Initial fetch with proper error handling
        const initializeFeed = async () => {
            try {
                await fetchNews();

                if (!isMounted) return;

                // Set up real-time subscription for articles only after successful initial fetch
                const supabase = createClient();
                subscription = supabase
                    .channel('articles_changes')
                    .on(
                        'postgres_changes',
                        {
                            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                            schema: 'public',
                            table: 'articles'
                        },
                        (payload) => {
                            console.log('Articles change received:', payload);
                            if (isMounted) {
                                fetchNews();
                            }
                        }
                    )
                    .subscribe((status) => {
                        console.log('Subscription status:', status);
                    });

                // Set up periodic visibility check
                const checkVisibility = () => {
                    if (!isMounted) return;
                    
                    // Force a re-render by updating the state
                    setNewsItems(prevItems => [...prevItems]);
                    
                    // Schedule next check in 1 minute
                    visibilityTimer = setTimeout(checkVisibility, 60000);
                };

                // Start visibility checking
                visibilityTimer = setTimeout(checkVisibility, 60000);

            } catch (error) {
                console.error('Failed to initialize feed:', error);
                if (isMounted) {
                    setError('Failed to initialize news feed');
                    setIsLoading(false);
                }
            }
        };

        initializeFeed();

        return () => {
            isMounted = false;
            if (subscription) {
                const supabase = createClient();
                supabase.removeChannel(subscription);
            }
            if (visibilityTimer) {
                clearTimeout(visibilityTimer);
            }
        };
    }, [fetchNews]);

    const handleArticleCreated = () => {
        setShowCreateDialog(false);
        fetchNews();
    };

    // Get currently visible articles
    const visibleNewsItems = getVisibleArticles(newsItems);

    if (isLoading) {
        return <div className="p-4 h-full overflow-hidden">Loading news...</div>;
    }

    if (error) {
        return (
            <div className="p-4 h-full overflow-hidden">
                <div className="text-red-600 mb-4">Error loading news: {error}</div>
                <Button 
                    onClick={() => fetchNews()} 
                    variant="outline" 
                    size="sm"
                    className="mb-4"
                >
                    Retry Loading
                </Button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
                <h1 className="text-xl font-bold">Latest News</h1>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="flex items-center"
                                onClick={() => setShowCreateDialog(true)}>
                            <PlusIcon className="mr-2 h-4 w-4"/>
                            Create news article
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Create news article</DialogTitle>
                        </DialogHeader>
                        <CreateArticleForm
                            onClose={() => setShowCreateDialog(false)}
                            onArticleCreated={handleArticleCreated}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {visibleNewsItems.length === 0 ? (
                    <p className="text-muted-foreground">No news articles found.</p>
                ) : (
                    <div className="space-y-4">
                        {visibleNewsItems.map((newsItem) => (
                            <Link key={newsItem.id} href={`/news/${newsItem.id}`} passHref legacyBehavior>
                                <a className="block cursor-pointer">
                                    <NewsPreview news={newsItem}/>
                                </a>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}