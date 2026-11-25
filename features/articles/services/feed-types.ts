export const ARTICLE_PAGE_SIZE = 20;

export interface FeedArticle {
    id: string;
    title: string;
    description: string;
    createdAt: Date;
    modifiedAt?: Date;
    eventDatetime: Date | null;
    eventAllDay: boolean;
    author: { name: string; avatar?: string };
}
