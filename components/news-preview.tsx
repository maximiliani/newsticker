"use client";

import { formatDate } from "@/utils/utils";
import { useState } from "react";
import { UserProfileDialog } from "./UserProfileDialog";

interface NewsPreviewData {
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

export function NewsPreview({ news }: { news: NewsPreviewData }) {
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
        <h2 className="text-lg font-semibold line-clamp-2">{news.title}</h2>

        {/* Description */}
        <p className="text-muted-foreground line-clamp-3 text-sm">{news.description}</p>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleAvatarClick}
              className="flex-shrink-0 hover:ring-2 hover:ring-primary rounded-full transition-all duration-200"
              title={`View ${news.author.name}'s profile`}
            >
              {news.author.avatar ? (
                <img
                  src={news.author.avatar}
                  alt={news.author.name}
                  className="w-5 h-5 rounded-full object-cover cursor-pointer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center cursor-pointer">
                  {news.author.name[0]}
                </div>
              )}
            </button>
            <span className="truncate">{news.author.name}</span>
          </div>
          
          <div className="text-right flex-shrink-0">
            <time dateTime={news.createdAt.toISOString()}>
              {formatDate(news.createdAt)}
            </time>
            {news.modifiedAt && (
              <div>
                <time dateTime={news.modifiedAt.toISOString()}>
                  Modified: {formatDate(news.modifiedAt)}
                </time>
              </div>
            )}
          </div>
        </div>
      </article>

      <UserProfileDialog
        open={showAuthorDialog}
        onOpenChange={setShowAuthorDialog}
        user={news.author}
        title="Author Profile"
      />
    </>
  );
}