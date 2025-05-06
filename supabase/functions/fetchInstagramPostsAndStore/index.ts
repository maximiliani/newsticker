/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient, SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {z} from "npm:zod";

export const IGUserSchema = z.object({
  id: z.number().gte(0),
  username: z.string(),
  profile_picture_url: z.string().optional(),
  access_token: z.string().url(),
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

// TypeScript types can be inferred from the schemas
export type IGUser = z.infer<typeof IGUserSchema>;
export type IGPost = z.infer<typeof IGPostSchema>;
export type IGMedia = z.infer<typeof IGMediaSchema>;

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

type InstagramAPIMedia = z.infer<typeof InstagramAPIMediaSchema>;
type InstagramAPIResponse = z.infer<typeof InstagramAPIResponseSchema>;

// Fix handleSingleElement function
async function handleSingleElement(
  preparedPost: IGPost,
  ig_media: InstagramAPIMedia,
  user_id: string,
  supabase: SupabaseClient,
  index: number = 0,
): Promise<IGMedia> {
  if (!ig_media || !preparedPost) {
    throw new Error("Invalid media or post data");
  }

  const media_type = ig_media.media_type.toLowerCase();
  if (!["image", "video"].includes(media_type)) {
    throw new Error(`Unsupported media type: ${media_type}`);
  }

  const { data, error } = await supabase.functions.invoke(
    "cloneRemoteFile",
    {
      body: {
        url: ig_media.media_url,
        storageBucket: "instagram-media",
        storagePath: `posts/${user_id}/${preparedPost.id}/${index}`,
      },
    },
  );
  if (!data || error) {
    throw new Error("Failed to download media");
  }

  // Fix thumbnail handling
  let thumbnail_url: string | undefined;
  if (ig_media.thumbnail_url) {
    const thumbnailResult = await supabase.functions.invoke(
      "cloneRemoteFile",
      {
        body: {
          url: ig_media.thumbnail_url,
          storageBucket: "instagram-media",
          storagePath: `posts/${user_id}/${preparedPost.id}/thumbnail_${index}`,
        },
      },
    );
    if (thumbnailResult.data) {
      thumbnail_url = thumbnailResult.data.publicUrl;
    }
  }

  const image_media: IGMedia = IGMediaSchema.parse({
    post_id: preparedPost.id,
    index,
    media_type: media_type as "image" | "video",
    media_url: data.publicUrl,
    thumbnail_url,
    timestamp: new Date(ig_media.timestamp).getTime(),
  });

  // Add await to database operation
  await supabase.from("instagram_post_media").upsert(image_media);
  return image_media;
}

// Fix createIGMedia function signature and return type
async function createIGMedia(
  supabase: SupabaseClient,
  media_id: string,
  user_id: string,
  access_token: string,
): Promise<IGMedia | IGMedia[]> {
  if (!media_id || !access_token) {
    throw new Error("media_id and access_token are required");
  }

  // Fix response parsing
  const response = await fetch(
    `https://graph.instagram.com/${media_id}?fields=id,media_type,media_url,permalink,thumbnail_url,timestamp,caption&access_token=${access_token}`
  );
  if (!response.ok) {
    throw new Error(`Instagram API error: ${await response.text()}`);
  }
  const ig_media = InstagramAPIMediaSchema.parse(await response.json());

  // Fix ID type conversion and add required fields
  const preparedPost: IGPost = IGPostSchema.parse({
    id: parseInt(ig_media.id),
    user_id: parseInt(user_id),
    caption: ig_media.caption,
    postedAt: new Date(ig_media.timestamp),
    timestamp: new Date(ig_media.timestamp).getTime(),
    media: [], // Will be populated later
  });

  // Add await to database operation
  await supabase.from("instagram_posts").upsert(preparedPost);

  switch (ig_media.media_type.toUpperCase()) {
    case "IMAGE":
    case "VIDEO": {
      const media = await handleSingleElement(
        preparedPost,
        ig_media,
        user_id,
        supabase,
      );
      preparedPost.media = [media];
      await supabase.from("instagram_posts").upsert(preparedPost);
      return media;
    }
    case "CAROUSEL_ALBUM": {
      const carouselResponse = await fetch(
        `https://graph.instagram.com/${ig_media.id}/children?fields=id,media_type,media_url,thumbnail_url,timestamp&access_token=${access_token}`
      );
      if (!carouselResponse.ok) {
        throw new Error(`Instagram API error: ${await carouselResponse.text()}`);
      }
      const carouselChildrenData = InstagramAPIResponseSchema.parse(
        await carouselResponse.json()
      );

      const createdElements: IGMedia[] = [];
      for (let i = 0; i < carouselChildrenData.data.length; i++) {
        const childMedia = carouselChildrenData.data[i];
        createdElements.push(await handleSingleElement( // Fix .add() to .push()
          preparedPost,
          childMedia,
          user_id,
          supabase,
          i,
        ));
      }
      preparedPost.media = createdElements;
      await supabase.from("instagram_posts").upsert(preparedPost);
      return createdElements;
    }
    default:
      throw new Error(`Unsupported media type: ${ig_media.media_type}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Start transaction
    const { data: igAccounts, error: accountsError } = await supabase
      .from("instagram_accounts")
      .select<
        "*",
        { user_id: string; username: string; access_token: string }
      >();

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

    // Process accounts in parallel with rate limiting
    const results = await Promise.allSettled(
      igAccounts.map(async (account) => {
        let nextUrl =
          `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp&access_token=${account.access_token}`;

        while (nextUrl) {
          const response = await fetch(nextUrl);
          if (!response.ok) {
            throw new Error(`Instagram API error: ${await response.text()}`);
          }

          const json = await response.json();
          const validated = InstagramAPIResponseSchema.parse(json);

          for (const ig_media of validated.data) {
            const media_id = ig_media.id;
            const user_id = account.user_id;
            const access_token = account.access_token;

            await createIGMedia(supabase, media_id, user_id, access_token);
          }

          nextUrl = validated.paging?.next || "";
        }
      }),
    );

    // Process results
    const errors = results
      .filter((result): result is PromiseRejectedResult =>
        result.status === "rejected"
      )
      .map((result) => result.reason);

    if (errors.length) {
      console.error("Errors during processing:", errors);
    }

    return new Response(
      JSON.stringify({
        message: "Instagram posts processed",
        errors: errors.length ? errors.map((e) => e.message) : undefined,
      }),
      {
        status: errors.length ? 207 : 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Critical error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});