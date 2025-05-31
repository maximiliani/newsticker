"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

import { CreateArticleButton } from "@/components/CreateArticleButton";
import { ArticleFilters } from "./ArticleFilters";
import { ArticleTable } from "./ArticleTable";
import { DeleteArticleDialog } from "./DeleteArticleDialog";
import { Article, ArticleVisibilityStatus } from "./ArticleInterfaceTypes";

interface ArticleManagerClientProps {
  initialArticles: Article[];
  user: User | null;
}

export function ArticleManagerClient({ initialArticles, user }: ArticleManagerClientProps) {
  // Add debugging
  console.log('ArticleManagerClient received articles:', initialArticles);
  console.log('ArticleManagerClient received user:', user?.id);

  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [filter, setFilter] = useState<ArticleVisibilityStatus>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const filteredArticles = articles.filter((article) => {
    const now = new Date();
    const visibilityFrom = new Date(article.visibility_from); // Updated property name
    const visibilityTo = article.visibility_to ? new Date(article.visibility_to) : null; // Updated property name

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

  console.log('Filtered articles:', filteredArticles);

  const handleArticleCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleEdit = useCallback((article: Article) => {
    router.push(`/news/${article.id}/edit`);
  }, [router]);

  const handleView = useCallback((article: Article) => {
    router.push(`/news/${article.id}`);
  }, [router]);

  const handleDeleteRequest = useCallback((articleId: string) => {
    setArticleToDelete(articleId);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!articleToDelete) return;

    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', articleToDelete);

      if (error) throw error;

      setArticles(articles.filter(article => article.id !== articleToDelete));
      toast({
        title: "Success",
        description: "Article deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting article:', error);
      toast({
        title: "Error",
        description: "Failed to delete article",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setArticleToDelete(null);
    }
  }, [articleToDelete, articles, supabase, toast]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
    setArticleToDelete(null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Article Manager</h1>
        <CreateArticleButton 
          user={user}
          onArticleCreated={handleArticleCreated} 
        />
      </div>

      <ArticleFilters
        currentFilter={filter}
        onFilterChange={setFilter}
      />

      {/* Add a debug section */}
      <div className="text-sm text-gray-500 p-2 bg-gray-100 rounded">
        Debug: Total articles: {articles.length}, Filtered articles: {filteredArticles.length}, Current filter: {filter}
      </div>

      <ArticleTable
        articles={filteredArticles}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        onView={handleView}
        currentUser={user}
      />

      <DeleteArticleDialog
        open={deleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        articleId={articleToDelete}
      />
    </div>
  );
}