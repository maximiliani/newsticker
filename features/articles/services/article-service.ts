import { createClient } from '@/lib/supabase/client';
import { Article, CreateArticleData, UpdateArticleData } from '@/types/article';
import { UserService } from "@/features/users/services/user-service";
import { logError } from '@/lib/utils/error-handling';
import { AppError } from '@/lib/utils/error-handling';

// Cache for article data to reduce database calls
const cache = new Map<string, { data: Article[], timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache TTL

export interface ArticlesByUser {
  userId: string;
  userEmail: string;
  userFullName: string;
  articles: Article[];
}

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
      const supabase = createClient();
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
   * Get all articles grouped by user (admin only)
   */
  static async getAllArticlesGroupedByUser(): Promise<ArticlesByUser[]> {
    try {
      const supabase = createClient();

      // Check if current user is admin
      const isAdmin = await UserService.isCurrentUserAdmin();
      if (!isAdmin) {
        throw new Error('Unauthorized: Only admins can access all articles');
      }

      // First, get all articles
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (articlesError) throw articlesError;

      if (!articles || articles.length === 0) {
        return [];
      }

      // Get unique user IDs from articles
      // Add null/undefined checks and filter out invalid user_ids
      const userIds = Array.from(new Set(articles.map(article => article.user_id)));

      // Fetch user information for all users who have articles
      // Try different approaches based on your database schema
      let usersData: any[] = [];
      
      try {
        // Try auth.users first
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        
        if (!authError && authUsers?.users) {
          usersData = authUsers.users.filter(user => userIds.includes(user.id));
        } else {
          throw new Error('Auth users not accessible');
        }
      } catch (authError) {
        console.warn('Could not fetch from auth.users, trying alternative approach:', authError);
        
        try {
          // Try users_secure table
          const { data: secureUsers, error: secureError } = await supabase
            .from('users_secure')
            .select('id, email, full_name')
            .in('id', userIds);

          if (!secureError && secureUsers) {
            usersData = secureUsers;
          } else {
            throw new Error('users_secure not accessible');
          }
        } catch (secureError) {
          console.warn('Could not fetch from users_secure, using fallback:', secureError);
          
          // Fallback: create user objects with just IDs
          usersData = userIds.map(id => ({
            id,
            email: 'Unknown',
            full_name: 'Unknown User'
          }));
        }
      }

      // Group articles by user
      const groupedArticles = new Map<string, ArticlesByUser>();

      articles.forEach((article: Article) => {
        const userId = article.user_id;
        const user = usersData.find(u => u.id === userId);

        if (!groupedArticles.has(userId)) {
          groupedArticles.set(userId, {
            userId,
            userEmail: user?.email || user?.user_metadata?.email || 'Unknown',
            userFullName: user?.full_name || user?.user_metadata?.full_name || 'Unknown User',
            articles: []
          });
        }

        groupedArticles.get(userId)?.articles.push(article);
      });

      return Array.from(groupedArticles.values());
    } catch (error) {
      logError(error, 'ArticleService.getAllArticlesGroupedByUser');
      throw new AppError('Failed to fetch articles', 'ARTICLES_FETCH_ERROR');
    }
  }

  /**
   * Get all articles (admin only)
   */
  static async getAllArticles(): Promise<Article[]> {
    try {
      const supabase = createClient();

      // Check if current user is admin
      const isAdmin = await UserService.isCurrentUserAdmin();
      if (!isAdmin) {
        throw new Error('Unauthorized: Only admins can access all articles');
      }

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logError(error, 'ArticleService.getAllArticles');
      throw new AppError('Failed to fetch articles', 'ARTICLES_FETCH_ERROR');
    }
  }

  /**
   * Create a new article
   */
  static async createArticle(data: CreateArticleData & { user_id: string }): Promise<Article> {
    try {
      console.log('ArticleService.createArticle called with data:', data);

      const supabase = createClient();

      // Extract media URLs from content if they exist
      const mediaUrls = this.extractMediaUrls(data.content, 'article_media');

      // Prepare the article data for insertion
      const articleData = {
        title: data.title,
        description: data.description,
        content: data.content,
        user_id: data.user_id,
        visibility_from: data.visibility_from,
        visibility_to: data.visibility_to || null,
        json_content: data.json_content || null,
        html_content: data.html_content || data.content,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      };

      console.log('Final article data for database:', articleData);

      const { data: article, error } = await supabase
        .from('articles')
        .insert(articleData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Article created in database:', article);

      // Invalidate cache
      this.invalidateUserCache(data.user_id);

      return article;
    } catch (error) {
      console.error('Error in ArticleService.createArticle:', error);
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

      // Only extract media URLs if content is being updated
      let articleData = { ...data };

      if (data.content) {
        // Extract media URLs from content if they exist
        const mediaUrls = this.extractMediaUrls(data.content, 'article_media');

        // Add media_urls to the data if we found any
        if (mediaUrls.length > 0) {
          articleData.media_urls = mediaUrls;
        }
      }

      // Handle json_content if provided
      if (data.json_content !== undefined) {
        articleData.json_content = data.json_content;
      }

      const { data: article, error } = await supabase
        .from('articles')
        .update(articleData)
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
      let isAdmin = false;

      // Check if current user is admin when no userId is provided or user is trying to delete someone else's article
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        throw new Error('Authentication required');
      }

      if (!userIdToInvalidate) {
        const { data: article } = await supabase
          .from('articles')
          .select('user_id')
          .eq('id', id)
          .single();

        userIdToInvalidate = article?.user_id;

        // If trying to delete someone else's article, check admin status
        if (userIdToInvalidate && userIdToInvalidate !== currentUser.id) {
          isAdmin = await UserService.isCurrentUserAdmin();
          if (!isAdmin) {
            throw new Error('Unauthorized: You cannot delete articles from other users');
          }
        }
      } else if (userIdToInvalidate !== currentUser.id) {
        // If userID is provided but differs from current user, check admin status
        isAdmin = await UserService.isCurrentUserAdmin();
        if (!isAdmin) {
          throw new Error('Unauthorized: You cannot delete articles from other users');
        }
      }

      // Delete associated media files first
      await this.deleteArticleMedia(id);

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
   * Delete media files associated with an article
   */
  private static async deleteArticleMedia(articleId: string): Promise<void> {
    try {
      const supabase = createClient();

      // Get article to find media URLs
      const { data: article, error: articleError } = await supabase
        .from('articles')
        .select('media_urls')
        .eq('id', articleId)
        .single();

      if (articleError) throw articleError;

      // Delete media from storage if any exists
      if (article?.media_urls && article.media_urls.length > 0) {
        // Extract storage paths from public URLs
        // URL format: .../storage/v1/object/public/article_media/{path}
        const mediaFiles = article.media_urls
          .map((url: string) => {
            const marker = '/article_media/';
            const idx = url.indexOf(marker);
            return idx !== -1 ? url.slice(idx + marker.length) : null;
          })
          .filter(Boolean) as string[];

        // Delete files from storage
        if (mediaFiles.length > 0) {
          const { error: deleteError } = await supabase
            .storage
            .from('article_media')
            .remove(mediaFiles);

          if (deleteError) {
            console.warn('Some article media files could not be deleted:', deleteError);
            // Continue with article deletion even if media deletion partially fails
          }
        }
      }
    } catch (error) {
      // Log but don't halt the overall deletion
      console.warn(`Error deleting article media for article ${articleId}:`, error);
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

  /**
   * Extract media URLs from content
   */
  private static extractMediaUrls(content: string, bucket: string): string[] {
    const mediaUrls: string[] = [];
    
    // This is a placeholder implementation - you'll need to implement based on your content structure
    // For example, if content contains HTML with img tags:
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    let match;
    
    while ((match = imgRegex.exec(content)) !== null) {
      const url = match[1];
      if (url.includes(bucket)) {
        mediaUrls.push(url);
      }
    }
    
    return mediaUrls;
  }
}