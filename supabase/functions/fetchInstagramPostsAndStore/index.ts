/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient, SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {z} from "npm:zod";

// Validation schemas and types
export const IGUserSchema = z.object({
  id: z.number().gte(0),
  username: z.string(),
  profile_picture_url: z.string().optional(),
  access_token: z.string().min(50),
  created_at: z.date(),
  updated_at: z.date().optional(),
  timestamp: z.number(),
});

export const IGMediaSchema = z.object({
  post_id: z.number().gte(0),
  index: z.number().gte(0),
  media_type: z.enum(["image", "video"]),
  media_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  timestamp: z.number(),
});

export const IGPostSchema = z.object({
  id: z.number().gte(0),
  user_id: z.number().gte(0),
  caption: z.string().optional(),
  postedAt: z.date(),
  media: z.array(IGMediaSchema).nonempty(),
  timestamp: z.number(),
});

const InstagramAPIMediaSchema = z.object({
  id: z.string(),
  media_type: z.string(),
  media_url: z.string().url(),
  permalink: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  timestamp: z.string(),
  caption: z.string().optional(),
});

const InstagramAPIResponseSchema = z.object({
  data: z.array(InstagramAPIMediaSchema),
  paging: z.object({
    next: z.string().url().optional(),
  }).optional(),
});

const RefreshTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

export type IGUser = z.infer<typeof IGUserSchema>;
export type IGPost = z.infer<typeof IGPostSchema>;
export type IGMedia = z.infer<typeof IGMediaSchema>;
type InstagramAPIMedia = z.infer<typeof InstagramAPIMediaSchema>;

// Utility functions
const fetchWithTimeout = async (
  url: string,
  options: RequestInit & { timeout?: number } = {},
) => {
  const { timeout = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

async function handleSingleElement(
  preparedPost: IGPost,
  ig_media: InstagramAPIMedia,
  user_id: string,
  supabase: SupabaseClient,
  index = 0,
): Promise<IGMedia> {
  if (!ig_media || !preparedPost) {
    throw new Error("Invalid media or post data");
  }

  const media_type = ig_media.media_type.toLowerCase();
  if (!["image", "video"].includes(media_type)) {
    throw new Error(`Unsupported media type: ${media_type}`);
  }

  // Use transaction for atomic operations
  const { data, error } = await supabase.rpc("handle_media_element", {
    media_url: ig_media.media_url,
    thumbnail_url: ig_media.thumbnail_url,
    user_id,
    post_id: preparedPost.id,
    index,
    media_type,
    timestamp: new Date(ig_media.timestamp).getTime(),
  });

  if (error || !data) {
    throw new Error(
      `Failed to process media: ${error?.message || "Unknown error"}`,
    );
  }

  return IGMediaSchema.parse(data);
}

async function createIGMedia(
  supabase: SupabaseClient,
  media_id: string,
  user_id: string,
  access_token: string,
): Promise<IGMedia | IGMedia[]> {
  if (!media_id || !access_token) {
    throw new Error("media_id and access_token are required");
  }

  // Token validation and refresh
  const testResponse = await fetchWithTimeout(
    `https://graph.instagram.com/me?access_token=${access_token}`,
  );

  if (!testResponse.ok) {
    const refreshResponse = await fetchWithTimeout(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${access_token}`,
    );

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh token");
    }

    const refreshData = RefreshTokenResponseSchema.parse(
      await refreshResponse.json(),
    );

    // Update token in transaction
    const { error: updateError } = await supabase
      .from("instagram_accounts")
      .update({
        access_token: refreshData.access_token,
        token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000)
          .toISOString(),
      })
      .eq("user_id", user_id);

    if (updateError) {
      throw new Error(`Failed to update token: ${updateError.message}`);
    }

    access_token = refreshData.access_token;
  }

  // Fetch media details
  const response = await fetchWithTimeout(
    `https://graph.instagram.com/${media_id}?fields=id,media_type,media_url,thumbnail_url,timestamp,caption&access_token=${access_token}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch media details");
  }

  const ig_media = InstagramAPIMediaSchema.parse(await response.json());

  // Process media based on type
  const { data: postData, error: postError } = await supabase.rpc(
    "create_instagram_post",
    {
      post_id: parseInt(ig_media.id),
      user_id: parseInt(user_id),
      caption: ig_media.caption,
      posted_at: new Date(ig_media.timestamp).toISOString(),
      timestamp: new Date(ig_media.timestamp).getTime(),
    },
  );

  if (postError || !postData) {
    throw new Error(
      `Failed to create post: ${postError?.message || "Unknown error"}`,
    );
  }

  const preparedPost = IGPostSchema.parse(postData);

  switch (ig_media.media_type.toUpperCase()) {
    case "IMAGE":
    case "VIDEO": {
      return await handleSingleElement(
        preparedPost,
        ig_media,
        user_id,
        supabase,
      );
    }
    case "CAROUSEL_ALBUM": {
      const carouselResponse = await fetchWithTimeout(
        `https://graph.instagram.com/${ig_media.id}/children?fields=id,media_type,media_url,thumbnail_url,timestamp&access_token=${access_token}`,
      );

      if (!carouselResponse.ok) {
        throw new Error("Failed to fetch carousel data");
      }

      const carouselData = InstagramAPIResponseSchema.parse(
        await carouselResponse.json(),
      );

      return await Promise.all(
        carouselData.data.map((childMedia, index) =>
          handleSingleElement(
            preparedPost,
            childMedia,
            user_id,
            supabase,
            index,
          )
        ),
      );
    }
    default:
      throw new Error(`Unsupported media type: ${ig_media.media_type}`);
  }
}

// Main request handler
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // Make sure to use service role key
    {
      auth: {
        persistSession: false,
      },
    },
  );

  try {
    const { data: igAccounts, error: accountsError } = await supabase
      .rpc('get_decrypted_instagram_tokens');

    if (accountsError) {
      throw new Error(
        `Failed to fetch Instagram accounts: ${accountsError.message}`,
      );
    }

    if (!igAccounts?.length) {
      return new Response(
        JSON.stringify({ message: "No Instagram accounts found" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const results = await Promise.all(
      igAccounts.map(async (account: { access_token: string; username: any; user_id: string; }) => {
        try {
          let nextUrl =
            `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp&access_token=${account.access_token}`;
          const processedMedia = [];
          console.log(
            `Processing account: ${account.username}, user_id: ${account.user_id}, access_token: ${account.access_token}`,
          );

          while (nextUrl) {
            const response = await fetchWithTimeout(nextUrl);
            if (!response.ok) {
              throw new Error("Failed to fetch media", {
                cause: JSON.stringify(response),
              });
            }

            const validated = InstagramAPIResponseSchema.parse(
              await response.json(),
            );

            for (const ig_media of validated.data) {
              const result = await createIGMedia(
                supabase,
                ig_media.id,
                account.user_id,
                account.access_token,
              );
              processedMedia.push(result);
            }

            nextUrl = validated.paging?.next || "";
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limiting
          }

          return {
            status: "fulfilled",
            account: account.username,
            processed: processedMedia.length,
          };
        } catch (error) {
          return { status: "rejected", account: account.username, error };
        }
      }),
    );

    const errors = results.filter((r) => r.status === "rejected");
    if (errors.length) {
      console.error("Processing errors:", errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          accountsProcessed: results.length,
          successfulAccounts: results.filter((r) =>
            r.status === "fulfilled"
          ).length,
          failedAccounts: errors.length,
          processingTime: Date.now() - startTime,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Critical error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});