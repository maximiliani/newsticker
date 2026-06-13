import { NewsPreview } from "@/components/news-preview";
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ArticleFeedClient } from './article-feed-client';

// Types aligned with project standards
interface ArticleWithAuthorInfo {
    id: string;
    title: string;
    description: string;
    created_at: string;
    modified_at: string;
    visibility_from: string;
    visibility_to: string | null;
    author_name: string | null;
    author_avatar: string | null;
};

interface NewsPreviewData {
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

// Server-side data fetching
async function getVisibleArticles(from?: string, to?: string): Promise<NewsPreviewData[]> {
    const supabase = await createClient();
    const now = new Date();

    try {
        let query = supabase
            .from('articles_with_author_info')
            .select('id, title, description, created_at, modified_at, visibility_from, visibility_to, author_name, author_avatar');

        if (from && to) {
            // When filtering by date, we show articles that overlap with the selected range
            const rangeStart = new Date(from);
            const rangeEnd = new Date(to);
            rangeEnd.setHours(23, 59, 59, 999);

            query = query
                .lte('visibility_from', rangeEnd.toISOString())
                .or(`visibility_to.is.null,visibility_to.gte.${rangeStart.toISOString()}`);
        } else {
            query = query
                .lte('visibility_from', now.toISOString()) // Only get articles that should be visible now
                .or(`visibility_to.is.null,visibility_to.gte.${now.toISOString()}`); // And haven't expired
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            return [];
        }

        if (!data) return [];

        return data.map((article: ArticleWithAuthorInfo) => ({
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
    } catch (error) {
        console.error('Error fetching articles:', error);
        return [];
    }
}

// Server Component
export default async function ArticleFeed({ searchParams }: { searchParams?: Promise<{ from?: string, to?: string }> }) {
    const params = await searchParams;
    const initialArticles = await getVisibleArticles(params?.from, params?.to);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Static header with client-side dialog */}
            <ArticleFeedClient/>
            
            {/* Server-rendered articles list */}
            <div className="flex-1 overflow-y-auto p-4">
                {initialArticles.length === 0 ? (
                    <div className="text-center py-12">
                         <p className="text-muted-foreground">No news articles found for the selected range.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {initialArticles.map((newsItem) => (
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