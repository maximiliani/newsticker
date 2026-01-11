export interface InstagramAccount {
  id: number;  // BIGINT from database
  username: string;
  profile_image_url: string | null;
  user_id: string;
}

export interface InstagramPost {
  id: number;
  user_id: string;
  media_url?: string;
  caption?: string;
  created_at: string;
}
