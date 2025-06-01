'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Article, ArticleVisibilityStatus } from '@/types/article';
import { User } from '@supabase/supabase-js';
import { logError } from '@/lib/utils/error-handling';

export function useArticles(initialArticles: Article[], user: User | null) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>(initialArticles);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ArticleVisibilityStatus>('all');

  const refreshArticles = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      logError(error, 'useArticles.refreshArticles');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const applyFilter = useCallback((articles: Article[], filter: ArticleVisibilityStatus) => {
    if (filter === 'all') return articles;

    const now = new Date();
    return articles.filter(article => {
      const visibilityFrom = new Date(article.visibility_from);
      const visibilityTo = article.visibility_to ? new Date(article.visibility_to) : null;

      switch (filter) {
        case 'current':
          return visibilityFrom <= now && (!visibilityTo || visibilityTo >= now);
        case 'future':
          return visibilityFrom > now;
        case 'past':
          return visibilityTo ? visibilityTo < now : false;
        default:
          return true;
      }
    });
  }, []);

  const updateFilter = useCallback((newFilter: ArticleVisibilityStatus) => {
    setFilter(newFilter);
    setFilteredArticles(applyFilter(articles, newFilter));
  }, [articles, applyFilter]);

  // Update filtered articles when articles or filter changes
  useEffect(() => {
    setFilteredArticles(applyFilter(articles, filter));
  }, [articles, filter, applyFilter]);

  // Set up Supabase realtime subscription
  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const subscription = supabase
      .channel('articles_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'articles',
        filter: `user_id=eq.${user.id}`
      }, refreshArticles)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, refreshArticles]);

  return {
    articles: filteredArticles,
    loading,
    refreshArticles,
    filter,
    updateFilter
  };
}
