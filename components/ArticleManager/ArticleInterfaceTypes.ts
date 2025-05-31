// types/article.ts
export interface Article {
    id: string;
    title: string;
    description: string;
    content: string;
    created_at: string;        // Changed from createdAt
    modified_at?: string;      // Changed from modifiedAt
    visibility_from: string;   // Changed from visibilityFrom
    visibility_to: string | null; // Changed from visibilityTo
    author_id: string;         // Changed from authorId
}

export type ArticleVisibilityStatus = 'current' | 'future' | 'past' | 'all';