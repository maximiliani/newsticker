// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.com/manual/examples/supabase-edge-functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper function to clean up Instagram data
async function cleanupUserInstagramData(supabase: any, userId: string): Promise<void> {
  try {
    // Get all Instagram accounts for the user
    const { data: accounts, error } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('user_id', userId);

    if (error) throw error;

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        // 1. Find posts for this account
        const { data: posts, error: postsError } = await supabase
          .from("instagram_posts")
          .select("id")
          .eq("user_id", account.id);

        if (postsError) throw postsError;

        const postIds = posts?.map(post => post.id) || [];

        // 2. Delete media files from storage for each post
        for (const postId of postIds) {
          await deleteStorageFilesByPrefix(supabase, 'instagram-media', `posts/${postId}/`);
        }

        // 3. Delete media records
        if (postIds.length > 0) {
          const { error: mediaError } = await supabase
            .from("instagram_post_media")
            .delete()
            .in("post_id", postIds);

          if (mediaError) throw mediaError;
        }

        // 4. Delete posts
        if (postIds.length > 0) {
          const { error: postsDeleteError } = await supabase
            .from("instagram_posts")
            .delete()
            .in("id", postIds);

          if (postsDeleteError) throw postsDeleteError;
        }

        // 5. Delete profile images
        await deleteStorageFilesByPrefix(supabase, 'instagram-profiles', `instagram-${account.id}-`);

        // 6. Delete the account itself
        const { error: accountError } = await supabase
          .from("instagram_accounts")
          .delete()
          .eq("id", account.id);

        if (accountError) throw accountError;
      }
    }
  } catch (error) {
    console.error(`Error cleaning up Instagram data for user ${userId}:`, error);
    // Don't throw, so we continue with user deletion even if some cleanup fails
  }
}

// Helper function to clean up article data
async function cleanupUserArticles(supabase: any, userId: string): Promise<void> {
  try {
    // Get all articles for the user
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, media_urls')
      .eq('user_id', userId);

    if (error) throw error;

    if (articles && articles.length > 0) {
      for (const article of articles) {
        // 1. Delete media files if any exist
        if (article.media_urls && article.media_urls.length > 0) {
          // Extract filenames from URLs
          const mediaFiles = article.media_urls.map((url: string) => {
            const parts = url.split('/');
            return parts[parts.length - 1];
          });

          // Delete files from storage
          if (mediaFiles.length > 0) {
            const { error: deleteError } = await supabase
              .storage
              .from('article-media')
              .remove(mediaFiles);

            if (deleteError) {
              console.warn('Some article media files could not be deleted:', deleteError);
              // Continue with article deletion even if media deletion partially fails
            }
          }
        }

        // 2. Delete the article itself
        const { error: articleError } = await supabase
          .from('articles')
          .delete()
          .eq('id', article.id);

        if (articleError) throw articleError;
      }
    }
  } catch (error) {
    console.error(`Error cleaning up articles for user ${userId}:`, error);
    // Don't throw, so we continue with user deletion even if some cleanup fails
  }
}

// Helper function to delete storage files by prefix
async function deleteStorageFilesByPrefix(supabase: any, bucket: string, prefix: string): Promise<void> {
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
    console.error(`Error deleting storage files with prefix ${prefix} from bucket ${bucket}:`, error);
    // Don't throw so deletion process can continue
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Admin key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get unprocessed deletion requests
    const { data: requests, error: fetchError } = await supabaseAdmin
      .from("user_deletion_requests")
      .select("*")
      .eq("processed", false);

    if (fetchError) {
      throw fetchError;
    }

    const results = [];

    // Process each deletion request
    for (const request of requests) {
      try {
        // 1. Clean up all the user's Instagram data
        await cleanupUserInstagramData(supabaseAdmin, request.user_id);

        // 2. Clean up all the user's article data
        await cleanupUserArticles(supabaseAdmin, request.user_id);

        // 3. Delete the user using admin API
        const { error } = await supabaseAdmin.auth.admin.deleteUser(
          request.user_id
        );

        if (error) {
          throw error;
        }

        // Mark the request as processed
        await supabaseAdmin
          .from("user_deletion_requests")
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq("id", request.id);

        results.push({
          id: request.id,
          success: true,
          user_id: request.user_id,
        });
      } catch (err) {
        console.error(`Failed to delete user ${request.user_id}:`, err);
        results.push({
          id: request.id,
          success: false,
          user_id: request.user_id,
          error: err.message,
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Error processing user deletions:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
