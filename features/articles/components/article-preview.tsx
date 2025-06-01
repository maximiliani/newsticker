"use client";

import { formatDate } from "@/utils/utils";
import { useState } from "react";
import { UserProfileDialog } from "@/components/UserProfileDialog";

interface ArticlePreviewProps {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  modifiedAt?: Date;
  author: {
    name: string;
    avatar?: string;
    email?: string;
  };
}

export function ArticlePreview({ article }: { article: ArticlePreviewProps }) {
  const [showAuthorDialog, setShowAuthorDialog] = useState(false);

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowAuthorDialog(true);
  };

  return (
    <>
      <article className="bg-card rounded-lg p-4 shadow-sm space-y-4 hover:bg-accent transition-colors duration-200 border hover:border-border hover:shadow-md w-full">
        {/* Title */}
        <h2 className="text-lg font-semibold line-clamp-2">{article.title}</h2>

        {/* Description */}
        <p className="text-muted-foreground line-clamp-3 text-sm">{article.description}</p>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleAvatarClick}
              className="flex-shrink-0 hover:ring-2 hover:ring-primary rounded-full transition-all duration-200"
              title={`View ${article.author.name}'s profile`}
            >
              {article.author.avatar ? (
                <img
                  src={article.author.avatar}
                  alt={article.author.name}
                  className="w-5 h-5 rounded-full object-cover cursor-pointer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center cursor-pointer">
                  {article.author.name[0]}
                </div>
              )}
            </button>
            <span className="truncate">{article.author.name}</span>
          </div>
          
          <div className="text-right flex-shrink-0">
            <time dateTime={article.createdAt.toISOString()}>
              {formatDate(article.createdAt)}
            </time>
            {article.modifiedAt && (
              <div>
                <time dateTime={article.modifiedAt.toISOString()}>
                  Modified: {formatDate(article.modifiedAt)}
                </time>
              </div>
            )}
          </div>
        </div>
      </article>

      <UserProfileDialog
        open={showAuthorDialog}
        onOpenChange={setShowAuthorDialog}
        user={article.author}
        title="Author Profile"
      />
    </>
  );
}

export { type ArticlePreviewProps };