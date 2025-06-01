import { createClient } from '@/lib/supabase/server';
import { ArticleService } from '../services/article-service';
import { ArticleManagerClient } from './article-manager-client';
import { logError } from '@/lib/utils/error-handling';
import { ArticleSkeleton } from './article-skeleton';

/**
 * Server component for article management
 * Fetches initial article data and passes it to the client component
 */
export default async function ArticleManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please log in to view your articles
      </div>
    );
  }

  try {
    // Fetch articles with the server component for initial SSR data
    const articles = await ArticleService.getUserArticles(user.id);

    // Enable debug mode in development environment
    const showDebug = process.env.NODE_ENV === 'development';

    return (
      <ArticleManagerClient 
        initialArticles={articles} 
        user={user} 
        showDebug={showDebug} 
      />
    );
  } catch (error) {
    logError(error, 'ArticleManager');
    return (
      <div className="space-y-4">
        <div className="text-center py-4 text-destructive bg-destructive/10 rounded-md">
          <p>Failed to load articles. Please try refreshing the page.</p>
        </div>

        {/* Show skeleton UI even in error state for better UX */}
        <ArticleSkeleton />
      </div>
    );
  }
}