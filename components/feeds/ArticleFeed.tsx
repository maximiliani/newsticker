import { loadArticlePage } from '@/features/articles/services/feed-actions';
import { ArticleFeedClient } from './article-feed-client';
import { getTranslations } from 'next-intl/server';

// Server Component: renders the first page; the client component handles the rest.
export default async function ArticleFeed({ searchParams }: { searchParams?: Promise<{ from?: string, to?: string }> }) {
    const params = await searchParams;
    const initialArticles = await loadArticlePage(0, params?.from, params?.to);
    const t = await getTranslations('Articles');

    return (
        <ArticleFeedClient
            feedTitle={t('latestNews')}
            createTitle={t('createNewsArticle')}
            emptyText={t('noArticlesFound')}
            initialArticles={initialArticles}
            from={params?.from}
            to={params?.to}
        />
    );
}
