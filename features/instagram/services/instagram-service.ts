import { createClient } from '@/lib/supabase/client';
import { InstagramAccount } from '@/types/instagram';
import { logError } from '@/lib/utils/error-handling';

export class InstagramService {
  static async getAccountsByUserId(userId: string): Promise<InstagramAccount[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("instagram_accounts")
      .select("id, username, profile_image_url, user_id")
      .eq("user_id", userId);

    if (error) {
      logError(error, 'InstagramService.getAccountsByUserId');
      throw error;
    }

    return data || [];
  }

  static async deleteAccount(accountId: string, userId: string): Promise<void> {
    const supabase = createClient();

    // 1. Delete posts and media first
    await this.deleteAssociatedData(accountId);

    // 2. Delete the account itself
    const { error } = await supabase
      .from("instagram_accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", userId);

    if (error) {
      logError(error, 'InstagramService.deleteAccount');
      throw error;
    }
  }

  private static async deleteAssociatedData(accountId: string): Promise<void> {
    const supabase = createClient();

    try {
      // 1. Find posts
      const { data: posts, error: postsError } = await supabase
        .from("instagram_posts")
        .select("id")
        .eq("user_id", accountId);

      if (postsError) throw postsError;

      const postIds = posts?.map(post => post.id) || [];

      // 2. Delete media files from storage
      if (postIds.length > 0) {
        await this.deletePostMedia(postIds);

        // 3. Delete media records
        const { error: mediaError } = await supabase
          .from("instagram_post_media")
          .delete()
          .in("post_id", postIds);

        if (mediaError) throw mediaError;

        // 4. Delete posts
        const { error: postsDeleteError } = await supabase
          .from("instagram_posts")
          .delete()
          .in("id", postIds);

        if (postsDeleteError) throw postsDeleteError;
      }

      // 5. Delete profile images
      await this.deleteProfileImages(accountId);
    } catch (error) {
      logError(error, 'InstagramService.deleteAssociatedData');
      throw error;
    }
  }

  private static async deletePostMedia(postIds: number[]): Promise<void> {
    const supabase = createClient();

    for (const postId of postIds) {
      await this.deleteStorageFilesByPrefix(supabase, 'instagram-media', `posts/${postId}/`);
    }
  }

  private static async deleteProfileImages(accountId: string): Promise<void> {
    const supabase = createClient();
    const profilePrefix = `instagram-${accountId}-`;
    await this.deleteStorageFilesByPrefix(supabase, 'instagram-profiles', profilePrefix);
  }

  private static async deleteStorageFilesByPrefix(supabase: any, bucket: string, prefix: string): Promise<void> {
    try {
      // List files in bucket
      const { data: files, error: listError } = await supabase
        .storage
        .from(bucket)
        .list('');

      if (listError) throw listError;
      if (!files || files.length === 0) return;

      // Filter matching files
      const matchingFiles = files.filter((file: { name: string; }) => file.name.startsWith(prefix));
      if (matchingFiles.length === 0) return;

      // Delete files
      const filePaths = matchingFiles.map((file: { name: any; }) => file.name);
      const { error: deleteError } = await supabase
        .storage
        .from(bucket)
        .remove(filePaths);

      if (deleteError) throw deleteError;
    } catch (error) {
      logError(error, `InstagramService.deleteStorageFilesByPrefix(${bucket}, ${prefix})`);
      throw error;
    }
  }
}
