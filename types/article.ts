export interface Article {
  id: string;
  title: string;
  description: string;
  content: string;
  created_at: string;
  modified_at?: string;
  visibility_from: string;
  visibility_to: string | null;
  author_id: string;
  user_id: string; // Add for consistency
}

export type ArticleVisibilityStatus = 'current' | 'future' | 'past' | 'all';

export interface CreateArticleData {
  title: string;
  description: string;
  content: string;
  visibility_from: string;
  visibility_to?: string;
}

export interface UpdateArticleData extends Partial<CreateArticleData> {
  id: string;
}
