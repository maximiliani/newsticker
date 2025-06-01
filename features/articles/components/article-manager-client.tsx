"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { Article } from "@/types/article";
import { useArticles } from "@/lib/hooks/use-articles";
import { ArticleFilters } from "./article-filters";
import { ArticleTable } from "./article-table";
import { DeleteArticleDialog } from "./delete-article-dialog";
import { CreateArticleButton } from "./create-article-button";
import { ArticleService } from "../services/article-service";
import { logError } from "@/lib/utils/error-handling";

interface ArticleManagerClientProps {
  initialArticles: Article[];
  user: User;
  showDebug?: boolean; // Optional prop to enable debug information
}

/**
 * Client component for managing articles
 * Handles article listing, filtering, and CRUD operations
 */
export function ArticleManagerClient({ 
  initialArticles, 
  user, 
  showDebug = process.env.NODE_ENV === 'development' 
}: ArticleManagerClientProps) {
  const router = useRouter();
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Custom hook to manage article state and filtering
  const {
    articles: filteredArticles,
    loading,
    refreshArticles,
    filter,
    updateFilter
  } = useArticles(initialArticles, user);

  // // Callback handlers for article actions
  // const handleArticleCreated = useCallback(() => {
  //   refreshArticles();
  // }, [refreshArticles]);

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
      setDeleteLoading(true);
      await ArticleService.deleteArticle(articleToDelete);
      await refreshArticles();
      setDeleteDialogOpen(false);
    } catch (error) {
      logError(error, 'ArticleManagerClient.handleDeleteConfirm');
      alert("Failed to delete article. Please try again.");
    } finally {
      setDeleteLoading(false);
      setArticleToDelete(null);
    }
  }, [articleToDelete, refreshArticles]);

  return (
      <div>
    {/*// <div className="space-y-6">*/}
    {/*//   /!* Header with title and create button *!/*/}
    {/*//   <div className="flex justify-between items-center">*/}
    {/*//     <h1 className="text-2xl font-bold">Manage Articles</h1>*/}
    {/*//     <CreateArticleButton */}
    {/*//       user={user}*/}
    {/*//       onArticleCreated={handleArticleCreated}*/}
    {/*//     />*/}
    {/*//   </div>*/}

      {/* Filter controls */}
      <ArticleFilters 
        currentFilter={filter}
        onFilterChange={updateFilter}
      />

      {/* Debug information - only shown in development or when explicitly enabled */}
      {showDebug && (
        <div className="text-sm text-gray-500 p-2 bg-gray-100 rounded">
          <p>Debug: Filtered articles: {filteredArticles.length}, Current filter: {filter}</p>
        </div>
      )}

      {/* Article table with loading state */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading articles...
        </div>
      ) : (
        <ArticleTable 
          articles={filteredArticles}
          currentUser={user}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onView={handleView}
        />
      )}

      {/* Delete confirmation dialog */}
      <DeleteArticleDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setArticleToDelete(null);
        }}
      />
    </div>
  );
}
