import { createClient } from '@/lib/supabase/client';
import { Article, CreateArticleData, UpdateArticleData } from '@/types/article';
import { logError } from '@/lib/utils/error-handling';
import { AppError } from '@/lib/utils/error-handling';

// Cache for article data to reduce database calls
const cache = new Map<string, { data: Article[], timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache TTL

/**
 * Service for article-related operations
 * Provides methods for CRUD operations on articles
 */
export class ArticleService {
  /**
   * Get articles for a specific user with optional caching
   * @param userId - User ID to fetch articles for
   * @param useCache - Whether to use cached results (default: true)
   */
  static async getUserArticles(userId: string, useCache = true): Promise<Article[]> {
    // Check cache first if enabled
    const cacheKey = `user_articles_${userId}`;
    if (useCache) {
      const cachedData = cache.get(cacheKey);
      const now = Date.now();

      if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
        return cachedData.data;
      }
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Update cache
      if (useCache) {
        cache.set(cacheKey, { 
          data: data || [], 
          timestamp: Date.now() 
        });
      }

      return data || [];
    } catch (error) {
      logError(error, 'ArticleService.getUserArticles');
      throw new AppError(
        'Failed to fetch articles', 
        'ARTICLES_FETCH_ERROR'
      );
    }
  }

  /**
   * Create a new article
   */
  static async createArticle(data: CreateArticleData & { user_id: string }): Promise<Article> {
    try {
      const supabase = createClient();
      const { data: article, error } = await supabase
        .from('articles')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      this.invalidateUserCache(data.user_id);

      return article;
    } catch (error) {
      logError(error, 'ArticleService.createArticle');
      throw new AppError(
        'Failed to create article', 
        'ARTICLE_CREATE_ERROR'
      );
    }
  }

  /**
   * Update an existing article
   */
  static async updateArticle(data: UpdateArticleData & { user_id: string }): Promise<Article> {
    try {
      const supabase = createClient();
      const { data: article, error } = await supabase
        .from('articles')
        .update(data)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      this.invalidateUserCache(data.user_id);

      return article;
    } catch (error) {
      logError(error, 'ArticleService.updateArticle');
      throw new AppError(
        'Failed to update article', 
        'ARTICLE_UPDATE_ERROR'
      );
    }
  }

  /**
   * Delete an article
   */
  static async deleteArticle(id: string, userId?: string): Promise<void> {
    try {
      const supabase = createClient();

      // Get user_id first if not provided, to invalidate cache later
      let userIdToInvalidate = userId;

      if (!userIdToInvalidate) {
        const { data: article } = await supabase
          .from('articles')
          .select('user_id')
          .eq('id', id)
          .single();

        userIdToInvalidate = article?.user_id;
      }

      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Invalidate cache if we have the user ID
      if (userIdToInvalidate) {
        this.invalidateUserCache(userIdToInvalidate);
      }
    } catch (error) {
      logError(error, 'ArticleService.deleteArticle');
      throw new AppError(
        'Failed to delete article', 
        'ARTICLE_DELETE_ERROR'
      );
    }
  }

  /**
   * Get a specific article by ID
   */
  static async getArticleById(id: string): Promise<Article | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      logError(error, 'ArticleService.getArticleById');
      throw new AppError(
        'Failed to fetch article', 
        'ARTICLE_FETCH_ERROR'
      );
    }
  }

  /**
   * Invalidate cache for a specific user
   */
  private static invalidateUserCache(userId: string): void {
    cache.delete(`user_articles_${userId}`);
  }

  /**
   * Clear all cached data
   */
  static clearCache(): void {
    cache.clear();
  }
}
