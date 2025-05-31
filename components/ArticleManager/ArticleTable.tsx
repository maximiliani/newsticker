"use client";

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { PencilIcon, TrashIcon, EyeIcon } from "lucide-react";
import { Article } from "./ArticleInterfaceTypes";
import { User } from "@supabase/supabase-js";

interface ArticleTableProps {
  articles: Article[];
  currentUser: User | null; // Add current user prop
  onEdit: (article: Article) => void;
  onDelete: (articleId: string) => void;
  onView: (article: Article) => void;
}

interface ArticleStatus {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}

function getArticleStatus(article: Article): ArticleStatus {
  const now = new Date();
  const visibilityFrom = new Date(article.visibility_from);
  const visibilityTo = article.visibility_to ? new Date(article.visibility_to) : null;
  
  if (visibilityFrom <= now && (!visibilityTo || visibilityTo >= now)) {
    return { label: "Active", variant: "default" };
  } else if (visibilityFrom > now) {
    return { label: "Scheduled", variant: "secondary" };
  } else if (visibilityTo && visibilityTo < now) {
    return { label: "Expired", variant: "outline" };
  }
  return { label: "Draft", variant: "secondary" };
}

export function ArticleTable({ articles, currentUser, onEdit, onDelete, onView }: ArticleTableProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No articles found</p>
      </div>
    );
  }

  // Helper function to check if current user owns the article
  const isOwner = (article: Article) => {
    return currentUser && article.user_id === currentUser.id;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Visibility Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Modified</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((article) => {
            const status = getArticleStatus(article);
            const visibilityPeriod = `${formatDate(new Date(article.visibility_from))} - ${
              article.visibility_to ? formatDate(new Date(article.visibility_to)) : 'Ongoing'
            }`;
            const userOwnsArticle = isOwner(article);

            return (
              <TableRow key={article.id}>
                <TableCell className="font-medium">
                  <div className="max-w-[200px] truncate" title={article.title}>
                    {article.title}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {visibilityPeriod}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {article.modified_at ? formatDate(new Date(article.modified_at)) : formatDate(new Date(article.created_at))}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {/* View button - always visible */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(article)}
                      aria-label={`View ${article.title}`}
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                    
                    {/* Edit button - only visible to owner */}
                    {userOwnsArticle && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(article)}
                        aria-label={`Edit ${article.title}`}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {/* Delete button - only visible to owner */}
                    {userOwnsArticle && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(article.id)}
                        aria-label={`Delete ${article.title}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}