"use client";

import { formatDate } from "@/utils/utils";
import { useLocale, useTranslations } from "next-intl";
import { getEventDateParts } from "@/lib/utils/event-datetime";
import { useState } from "react";
import { UserProfileDialog } from "./UserProfileDialog";
import { cn } from "@/lib/utils";

interface NewsPreviewData {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  modifiedAt?: Date;
  eventDatetime?: Date | null;
  eventAllDay?: boolean;
  author: {
    name: string;
    avatar?: string;
    email?: string;
  };
}

export function NewsPreview({ news, timezone, isToday = false }: { news: NewsPreviewData; timezone: string; isToday?: boolean }) {
  const [showAuthorDialog, setShowAuthorDialog] = useState(false);
  const locale = useLocale();
  const t = useTranslations("Articles");
  const dateParts = news.eventDatetime
    ? getEventDateParts(news.eventDatetime, timezone, locale, news.eventAllDay)
    : null;

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowAuthorDialog(true);
  };

  return (
    <article className={cn("bg-card rounded-lg shadow-sm flex hover:bg-accent transition-colors duration-200 border hover:border-border hover:shadow-md w-full relative overflow-hidden", isToday && "border-primary ring-2 ring-primary/40")}>
      {/* Date highlight (global timezone) */}
      {dateParts && news.eventDatetime && (
        <time
          dateTime={news.eventDatetime.toISOString()}
          className={cn("flex flex-col items-center justify-center flex-shrink-0 w-20 px-2 py-4 border-r bg-muted/50 text-center leading-tight", isToday && "bg-primary/15")}
        >
          <span className="text-4xl font-extrabold text-primary">{dateParts.day}</span>
          <span className="text-base font-medium uppercase">{dateParts.month}</span>
          {isToday && <span className="text-xs font-semibold text-primary">{t("today")}</span>}
          {dateParts.time && (
            <span className="text-sm font-light text-muted-foreground">{dateParts.time}</span>
          )}
        </time>
      )}

      <div className="flex flex-col gap-4 p-4 min-w-0 flex-1">
      {/* Title */}
      <h2 className="text-lg font-semibold line-clamp-2">{news.title}</h2>

      {/* Description */}
      <p className="text-muted-foreground line-clamp-3 text-sm">{news.description}</p>

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleAvatarClick}
            className="flex-shrink-0 hover:ring-2 hover:ring-primary rounded-full transition-all duration-200"
            title={`View ${news.author.name}'s profile`}
          >
            {news.author.avatar ? (
              <img
                src={news.author.avatar}
                alt={news.author.name}
                className="size-5 rounded-full object-cover cursor-pointer"
              />
            ) : (
              <div className="size-5 rounded-full bg-secondary flex items-center justify-center cursor-pointer">
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

      <UserProfileDialog
        open={showAuthorDialog}
        onOpenChange={setShowAuthorDialog}
        user={news.author}
        title="Author Profile"
      />
      </div>
    </article>
  );
}
