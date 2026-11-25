import type { IGPostData } from "@/features/instagram/components/instagram-post";

export const INSTAGRAM_PAGE_SIZE = 12;

export interface InstagramFeedCursor {
    timestamp: number;
    id: string;
}

export interface InstagramFeedPage {
    posts: IGPostData[];
    hasMore: boolean;
    nextCursor: InstagramFeedCursor | null;
}
