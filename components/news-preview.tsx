import { formatDate } from "@/utils/utils";

interface NewsPreviewData {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  modifiedAt?: Date;
  author: {
    name: string;
    avatar?: string;
  };
}

export function NewsPreview({ news }: { news: NewsPreviewData }) {
  return (
    <article className="bg-card rounded-lg p-4 shadow-sm space-y-4 hover:bg-accent transition-colors duration-200 border hover:border-border hover:shadow-md mb-4">
      {/* Title */}
      <h2 className="text-xl font-semibold line-clamp-2">{news.title}</h2>

      {/* Description */}
      <p className="text-muted-foreground line-clamp-4">{news.description}</p>

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-2">
          {news.author.avatar ? (
            <img
              src={news.author.avatar}
              alt={news.author.name}
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
              {news.author.name[0]}
            </div>
          )}
          <span>{news.author.name}</span>
        </div>
        
        <div className="space-x-2">
          <time dateTime={news.createdAt.toISOString()}>
            Created: {formatDate(news.createdAt)}
          </time>
          {news.modifiedAt && (
            <time dateTime={news.modifiedAt.toISOString()}>
              Modified: {formatDate(news.modifiedAt)}
            </time>
          )}
        </div>
      </div>
    </article>
  );
} 