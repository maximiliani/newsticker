import { loadInitialArticlePage } from '@/features/articles/services/feed-actions';
import { ArticleFeedClient } from './article-feed-client';
import { getTranslations } from 'next-intl/server';

// Server Component: renders the first page; the client component handles the rest.
export default async function ArticleFeed({ searchParams }: { searchParams?: Promise<{ from?: string, to?: string }> }) {
    const params = await searchParams;
    const { articles: initialArticles, offset, timezone, today } = await loadInitialArticlePage(params?.from, params?.to);
    const t = await getTranslations('Articles');

    return (
        <ArticleFeedClient
            feedTitle={t('latestNews')}
            createTitle={t('createNewsArticle')}
            emptyText={t('noArticlesFound')}
            initialArticles={initialArticles}
            initialOffset={offset}
            timezone={timezone}
            initialToday={today}
            from={params?.from}
            to={params?.to}
        />
    );
}
