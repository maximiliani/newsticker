export interface Article {
  id: string;
  title: string;
  description: string;
  content: string;
  json_content?: any; // JSON content from Plate.js editor
  created_at: string;
  modified_at?: string;
  visibility_from: string;
  visibility_to: string | null;
  author_id: string;
  user_id: string; // Add for consistency
  media_urls?: string[]; // Array of media URLs stored in Supabase storage
}

export type ArticleVisibilityStatus = 'current' | 'future' | 'past' | 'all';

export interface CreateArticleData {
  title: string;
  description: string;
  content: string;
  json_content?: any; // JSON content from Plate.js editor
  html_content?: string; // HTML content (can be same as content)
  visibility_from: string;
  visibility_to?: string;
  media_urls?: string[]; // Array of media URLs stored in Supabase storage
}

export interface UpdateArticleData extends Partial<CreateArticleData> {
  id: string;
}