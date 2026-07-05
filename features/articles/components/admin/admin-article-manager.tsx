"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { ArticleService } from '@/features/articles/services/article-service';
import { Article } from '@/types/article';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrashIcon, PencilIcon, EyeIcon } from 'lucide-react';
import Link from 'next/link';

interface AdminArticleManagerProps {
  initialArticles: Article[];
}

export function AdminArticleManager({ initialArticles }: AdminArticleManagerProps) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteArticle = async () => {
    if (!selectedArticle) return;

    try {
      setIsDeleting(true);

      // Call service to delete the article
      await ArticleService.deleteArticle(selectedArticle.id);

      // Update local state
      setArticles(articles.filter(article => article.id !== selectedArticle.id));
      setIsDeleteDialogOpen(false);
      toast.success('Article deleted successfully');
    } catch (error) {
      console.error('Failed to delete article:', error);
      toast.error('Failed to delete article');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.length > 0 ? (
          articles.map((article) => (
            <Card key={article.id}>
              <CardHeader>
                <CardTitle className="line-clamp-2">{article.title}</CardTitle>
                <CardDescription>
                  <span className="block">By user: {article.user_id}</span>
                  <span className="block text-xs">
                    {new Date(article.created_at).toLocaleString()}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-24">
                  <p className="text-sm line-clamp-3">{article.description}</p>
                </ScrollArea>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Link href={`/articles/${article.id}`}>
                  <Button variant="outline" size="sm">
                    <EyeIcon className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSelectedArticle(article);
                    setIsDeleteDialogOpen(true);
                  }}
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <p className="col-span-3 text-center text-muted-foreground py-10">
            No articles found.
          </p>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Article</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the article "{selectedArticle?.title}"? This action cannot be undone and will permanently remove the article and all associated media.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteArticle}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
