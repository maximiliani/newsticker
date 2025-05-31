"use client";

import { NewsPreview } from "@/components/news-preview";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {CreateArticleForm} from "@/components/CreateArticleForm";

// Type for data structure from the 'articles_with_author_info' view
type ArticleFromView = {
    id: string;
    title: string;
    description: string;
    created_at: string; 
    modified_at: string; 
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

    const supabase = createClient();

    const fetchNews = async () => {
        setIsLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await supabase
            .from('articles_with_author_info') 
            .select('id, title, description, created_at, modified_at, author_name, author_avatar')
            .order('created_at', { ascending: false });

        if (fetchError) {
            console.error('Error fetching news:', fetchError);
            setError(fetchError.message);
            setNewsItems([]);
        } else if (data) {
            const transformedData: NewsPreviewInputData[] = data.map((article: ArticleFromView) => ({
                id: article.id,
                title: article.title,
                description: article.description,
                createdAt: new Date(article.created_at),
                modifiedAt: new Date(article.modified_at),
                author: {
                    name: article.author_name || 'Anonymous',
                    avatar: article.author_avatar || undefined,
                },
            }));
            setNewsItems(transformedData);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchNews();
    }, []);

    const handleArticleCreated = () => {
        setShowCreateDialog(false);
        fetchNews(); 
    };

    if (isLoading) {
        return <div className="p-4 h-full overflow-hidden">Loading news...</div>;
    }

    if (error) {
        return <div className="p-4 h-full overflow-hidden">Error loading news: {error}</div>;
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
                <h1 className="text-xl font-bold">Latest News</h1>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="flex items-center" onClick={() => setShowCreateDialog(true)}>
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
                {newsItems.length === 0 ? (
                    <p className="text-muted-foreground">No news articles found.</p>
                ) : (
                    <div className="space-y-4">
                        {newsItems.map((newsItem) => (
                            <Link key={newsItem.id} href={`/news/${newsItem.id}`} passHref legacyBehavior>
                                <a className="block cursor-pointer">
                                    <NewsPreview news={newsItem} />
                                </a>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}