/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient, SupabaseClient} from "jsr:@supabase/supabase-js@2";
import {z} from 'zod/v4';

// -------------------------
// Validation schemas and types for Instagram data
// -------------------------

/**
 * Defines the Zod schema for an Instagram user record in the database.
 */
export const IGUserSchema = z.object({
  id: z.number().gte(0), // User ID, must be a non-negative integer
  username: z.string(), // Instagram username
  profile_picture_url: z.string().optional().nullable(), // Optional URL for the profile picture
  access_token: z.string().min(50), // Instagram API access token, must be at least 50 characters
  created_at: z.iso.datetime({ offset: true }), // Timestamp of creation, ISO 8601 format with offset
  updated_at: z.iso.datetime({ offset: true }).optional().nullable(), // Optional timestamp of last update
  timestamp: z.number(), // Generic timestamp, likely for sorting or internal use
});

/**
 * Defines the Zod schema for media associated with an Instagram post (e.g., image or video).
 */
export const IGMediaSchema = z.object({
  post_id: z.number().gte(0), // ID of the parent post, must be a non-negative integer
  index: z.number().gte(0), // Index of the media item within a carousel post (0 for single media)
  media_type: z.enum(["image", "video"]), // Type of media, restricted to "image" or "video"
  media_url: z.url(), // URL of the media content
  thumbnail_url: z.url().optional().nullable(), // Optional URL for the media thumbnail
  timestamp: z.number(), // Generic timestamp for the media item
});

/**
 * Defines the Zod schema for an Instagram post record in the database.
 */
export const IGPostSchema = z.object({
  id: z.number().gte(0), // Post ID, must be a non-negative integer
  user_id: z.number().gte(0), // ID of the user who created the post
  caption: z.string().optional().nullable(), // Optional caption for the post
  posted_at: z.iso.datetime({ offset: true }), // Timestamp when the post was made, ISO 8601 format
  updated_at: z.iso.datetime({ offset: true }).optional().nullable(), // Optional timestamp of last update
  timestamp: z.number().gte(0), // Generic timestamp, non-negative
});

/**
 * Schema for a single media element as returned by the raw Instagram API.
 * Includes a transformation to ensure media_url is populated, using thumbnail_url as a fallback.
 */
const InstagramAPIMediaSchema = z.object({
  id: z.string(), // Media ID from Instagram
  media_type: z.string(), // Type of media (e.g., IMAGE, VIDEO, CAROUSEL_ALBUM)
  media_url: z.url().nullable().optional(), // URL of the media, can be missing or null
  thumbnail_url: z.url().nullable().optional(), // URL of the thumbnail, can be missing or null
  timestamp: z.string(), // Timestamp of media creation (ISO 8601 string)
  caption: z.string().nullable().optional(), // Caption for the media
}).transform((data) => ({
  ...data,
  // Use thumbnail_url as a fallback if media_url is not present
  media_url: data.media_url || data.thumbnail_url || null,
}));

/**
 * Schema for a paginated Instagram API response containing multiple media items.
 */
const InstagramAPIResponseSchema = z.object({
  data: z.array(InstagramAPIMediaSchema), // Array of media items
  paging: z.object({ // Optional pagination information
    cursors: z.object({
      before: z.string().optional().nullable(), // Cursor for previous page
      after: z.string().optional().nullable(), // Cursor for next page
    }),
  }).optional().nullable(),
});

/**
 * Schema for the structure of an Instagram API access token refresh response.
 */
const RefreshTokenResponseSchema = z.object({
  access_token: z.string(), // The new, refreshed access token
  expires_in: z.number(), // Duration in seconds until the new token expires
});

// TypeScript types inferred from the Zod schemas
export type IGUser = z.infer<typeof IGUserSchema>;
export type IGPost = z.infer<typeof IGPostSchema>;
export type IGMedia = z.infer<typeof IGMediaSchema>;
type InstagramAPIMedia = z.infer<typeof InstagramAPIMediaSchema>;
type InstagramAPIResponse = z.infer<typeof InstagramAPIResponseSchema>;

// -------------------------
// Utility function: fetch with timeout support
// -------------------------

/**
 * Wraps the native `fetch` API with a timeout mechanism.
 * If the request takes longer than the specified timeout, it will be aborted.
 * @param url The URL to fetch.
 * @param options RequestInit options, plus an optional `timeout` in milliseconds.
 * @returns A Promise that resolves with the Fetch API Response.
 * @throws Will throw an error if the fetch aborts or encounters a network error.
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit & { timeout?: number } = {},
) => {
  const { timeout = 30000, ...fetchOptions } = options; // Default timeout is 30 seconds
  const controller = new AbortController(); // Used to abort the fetch request
  const id = setTimeout(() => controller.abort(), timeout); // Set a timer to abort the request

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal, // Pass the AbortController's signal to fetch
    });
    clearTimeout(id); // Clear the timeout if the fetch completes successfully
    return response;
  } catch (error) {
    clearTimeout(id); // Ensure timeout is cleared on error as well
    throw error; // Re-throw the error
  }
};

// -------------------------
// Handles a single media element for a post and stores in DB
// -------------------------

/**
 * Processes a single media item (image or video) associated with a post and upserts it into the database.
 * @param preparedPost The parent Instagram post object (already created or upserted in DB).
 * @param ig_media The raw media data from the Instagram API.
 * @param supabase The Supabase client instance.
 * @param index The index of this media item, primarily for carousels (defaults to 0).
 * @returns A Promise that resolves with the processed and validated IGMedia object.
 * @throws If media data is invalid, media type is unsupported, or database operation fails.
 */
async function handleSingleElement(
  preparedPost: IGPost,
  ig_media: InstagramAPIMedia,
  supabase: SupabaseClient,
  index = 0,
): Promise<IGMedia> {
  // Validate input parameters
  if (!ig_media || !preparedPost) {
    throw new Error(
      "Invalid media or post data provided to handleSingleElement",
    );
  }

  const media_type = ig_media.media_type.toLowerCase();
  // Ensure media type is supported
  if (!["image", "video"].includes(media_type)) {
    throw new Error(`Unsupported media type encountered: ${media_type}`);
  }

  console.log(
    `Processing media of type "${media_type}" for post ID: ${preparedPost.id}, media API ID: ${ig_media.id}`,
  );

  // Upsert (insert or update) the media entry in the 'instagram_post_media' table
  const { data, error } = await supabase
    .from("instagram_post_media")
    .upsert({
      post_id: preparedPost.id,
      index: index,
      media_type: media_type as "image" | "video", // Cast to specific enum types
      media_url: ig_media.media_url,
      thumbnail_url: ig_media.thumbnail_url,
      timestamp: new Date(ig_media.timestamp).getTime(), // Convert ISO string to Unix timestamp
    })
    .select() // Select the upserted row
    .single(); // Expect a single row

  // Handle potential database errors
  if (error || !data) {
    console.error("Failed to upsert media element:", error);
    throw new Error(
      `Failed to process and store media: ${
        error?.message || "Unknown database error"
      }`,
    );
  }
  console.info("Successfully processed and stored media element:", data);

  // Validate the database response against the IGMediaSchema and return
  return IGMediaSchema.parse(data);
}

// -------------------------
// Creates IG media and handles authentication/token refresh if needed
// -------------------------

/**
 * Fetches media details from Instagram API, handles token refresh if necessary,
 * creates/updates the corresponding post and media items in the Supabase database.
 * @param supabase The Supabase client instance.
 * @param media_id The ID of the Instagram media to fetch.
 * @param user_id The internal database ID of the Instagram user.
 * @param access_token The current Instagram API access token for the user.
 * @returns A Promise that resolves when processing is complete. The specific return type depends on the media type (void or IGMedia for single items).
 * @throws If required parameters are missing, token refresh fails, API requests fail, or database operations fail.
 */
async function createIGMedia(
  supabase: SupabaseClient,
  media_id: string, // Instagram's ID for the media
  user_id: string, // Your internal user ID for the Instagram account
  access_token: string,
) {
  if (!media_id || !access_token || !user_id) {
    throw new Error(
      "media_id, user_id, and access_token are required for createIGMedia",
    );
  }

  let current_access_token = access_token;

  // Test the current access token by making a simple API call
  const testResponse = await fetchWithTimeout(
    `https://graph.instagram.com/me?access_token=${current_access_token}`,
  );

  // If the token is invalid or expired (response not OK)
  if (!testResponse.ok) {
    console.warn(
      `Access token for user_id ${user_id} might be invalid or expired. Attempting refresh.`,
    );
    // Attempt to refresh the access token
    const refreshResponse = await fetchWithTimeout(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${current_access_token}`,
    );

    if (!refreshResponse.ok) {
      const errorBody = await refreshResponse.text();
      console.error(
        `Failed to refresh token for user_id ${user_id}. Status: ${refreshResponse.status}, Body: ${errorBody}`,
      );
      throw new Error(
        `Failed to refresh token. API responded with status ${refreshResponse.status}`,
      );
    }

    // Parse the refresh token response
    const refreshData = RefreshTokenResponseSchema.parse(
      await refreshResponse.json(),
    );

    // Update the access token and its expiry in the database
    const { error: updateError } = await supabase
      .from("instagram_accounts") // Assuming this is your table for Instagram accounts
      .update({
        access_token: refreshData.access_token,
        token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000) // Calculate expiry date
          .toISOString(),
      })
      .eq("id", user_id); // Match by your internal user ID

    if (updateError) {
      console.error(
        `Failed to update token in database for user_id ${user_id}:`,
        updateError,
      );
      throw new Error(
        `Failed to update token in database: ${updateError.message}`,
      );
    }

    console.info(
      `Access token refreshed and updated in DB for user_id ${user_id}.`,
    );
    // Use the newly refreshed token for subsequent requests
    current_access_token = refreshData.access_token;
  }

  // Fetch detailed information for the specified media ID using the (potentially refreshed) token
  const mediaDetailsUrl =
    `https://graph.instagram.com/${media_id}?fields=id,media_type,media_url,permalink,thumbnail_url,timestamp,caption&access_token=${current_access_token}`;
  const response = await fetchWithTimeout(mediaDetailsUrl);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to fetch media details from Instagram API:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url: mediaDetailsUrl,
    });
    throw new Error(
      `Failed to fetch media details: ${response.status} ${response.statusText}. Response: ${errorText}`,
    );
  }

  const responseJson = await response.json();
  console.log(
    "Raw API Response for media details:",
    JSON.stringify(responseJson, null, 2),
  );

  let media: InstagramAPIMedia;
  try {
    // Validate and transform the raw API response for the media item
    media = InstagramAPIMediaSchema.parse(responseJson);
    if (!media.media_url && !media.thumbnail_url) { // Ensure there's at least one URL
      console.error(
        `No media_url or thumbnail_url available for media ID ${media_id}`,
        media,
      );
      throw new Error(
        `No media URL or thumbnail URL available for media ID ${media_id}`,
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation Error for InstagramAPIMediaSchema:", {
        issues: error.issues,
        receivedData: responseJson,
      });
    }
    throw error; // Re-throw the error after logging
  }

  // Log extracted media details for debugging
  console.log("Parsed Media ID:", media.id);
  console.log("User ID:", user_id);
  console.log("Parsed Media Type:", media.media_type);
  console.log("Parsed Media URL:", media.media_url);
  console.log("Parsed Thumbnail URL:", media.thumbnail_url);
  console.log("Parsed Caption:", media.caption);
  console.log("Parsed Posted At (timestamp string):", media.timestamp);

  // Upsert the Instagram post into the 'instagram_posts' table
  const { data: postData, error: postError } = await supabase
    .from("instagram_posts")
    .upsert({
      id: parseInt(media.id), // Use Instagram's media ID as the post ID
      user_id: parseInt(user_id), // Internal user ID
      caption: media.caption || null, // Use null if caption is not provided
      posted_at: new Date(media.timestamp).toISOString(), // Convert timestamp string to ISO string
      timestamp: new Date(media.timestamp).getTime(), // Convert timestamp string to Unix ms
    })
    .select()
    .single();

  if (postError || !postData) {
    console.error("Failed to upsert post in database:", postError);
    throw new Error(
      `Failed to create or update post in database: ${
        postError?.message || "Unknown database error"
      }`,
    );
  }

  console.info("Post data after upsert:", postData);
  // Validate the upserted post data against the schema
  const preparedPost = IGPostSchema.parse(postData);
  console.info("Successfully created/updated post:", preparedPost);

  const upperMediaType = media.media_type.toUpperCase();

  // Handle different media types (IMAGE, VIDEO, CAROUSEL_ALBUM)
  if (upperMediaType === "IMAGE" || upperMediaType === "VIDEO") {
    // For single image or video, process it directly
    await handleSingleElement(preparedPost, media, supabase);
  } else if (upperMediaType === "CAROUSEL_ALBUM") {
    // For carousel albums, fetch its child media items
    console.log(`Fetching children for carousel album ID: ${media.id}`);
    const carouselChildrenUrl =
      `https://graph.instagram.com/${media.id}/children?fields=id,media_type,media_url,thumbnail_url,timestamp&access_token=${current_access_token}`;
    const carouselResponse = await fetchWithTimeout(carouselChildrenUrl);

    if (!carouselResponse.ok) {
      const errorText = await carouselResponse.text();
      console.error("Failed to fetch carousel children data:", {
        status: carouselResponse.status,
        error: errorText,
        url: carouselChildrenUrl,
      });
      throw new Error(
        `Failed to fetch carousel children data: ${carouselResponse.statusText}. Response: ${errorText}`,
      );
    }

    const carouselJsonResponse = await carouselResponse.json();
    // Validate the API response for carousel children
    const carouselData = InstagramAPIResponseSchema.parse(carouselJsonResponse);

    // Process each child media item in the carousel
    await Promise.all(
      carouselData.data.map((childMedia, index) => {
        console.log(
          `Processing carousel child index ${index} for post ID ${preparedPost.id}, child media ID ${childMedia.id}`,
        );
        return handleSingleElement(preparedPost, childMedia, supabase, index);
      }),
    );
    console.info(
      `Finished processing ${carouselData.data.length} children for carousel album ID: ${media.id}`,
    );
  } else {
    // Log and throw an error for unsupported media types
    console.warn(
      `Unsupported media type encountered: ${media.media_type} for media ID ${media.id}`,
    );
    throw new Error(`Unsupported media type: ${media.media_type}`);
  }
}

// -------------------------
// Deno HTTP server handler for batch media import
// -------------------------

async function syncToVault(supabase: SupabaseClient){
  const supabaseUrlFromEnv = Deno.env.get("SUPABASE_URL");
  const serviceKeyFromEnv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const vaultSupabaseUrlName = "CRON_SUPABASE_PROJECT_URL";
  const vaultServiceKeyName = "CRON_SUPABASE_SERVICE_KEY";

  if (!supabaseUrlFromEnv || !serviceKeyFromEnv) {
    console.error(
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set. Cannot sync to Vault.",
    );
    // Depending on your error handling strategy, you might want to return an error response here.
    // For example:
    // return new Response(JSON.stringify({ error: "Critical environment variables missing, cannot sync to Vault." }), { status: 500, headers: { "Content-Type": "application/json" } });
  } else {
    try {
      const upsertVaultSecret = async (name: string, value: string) => {
        console.log(`Attempting to upsert vault secret '${name}' using SQL function.`);

        // The supabase client is presumably already initialized and available as `supabase`
        // in the scope where this function is called.
        // If not, you'd initialize it here:
        // const supabase = createClient(supabaseUrlFromEnv, serviceKeyFromEnv);

        const { error: rpcError } = await supabase.rpc("upsert_vault_secret", {
          p_secret_name: name,
          p_secret_value: value,
          p_secret_description: `Automatically synced ${name} by Edge Function`,
          // p_key_id: null, // Or pass a specific UUID if needed; null uses the default
        });

        if (rpcError) {
          console.error(`Error calling upsert_vault_secret for '${name}':`, rpcError.message);
          throw rpcError;
        }

        console.log(`Successfully called upsert_vault_secret for '${name}'. The SQL function handled create or update.`);
      };

      // Sync the environment variables to the Vault
      await upsertVaultSecret(vaultSupabaseUrlName, supabaseUrlFromEnv);
      await upsertVaultSecret(vaultServiceKeyName, serviceKeyFromEnv);

      console.log("Vault sync process completed.");

    } catch (error) {
      console.error("Failed to sync one or more environment variables to Supabase Vault:", error);
      // Critical failure? If pg_cron relies on this, you might want to return an error.
      return new Response(JSON.stringify({ error: "Failed to sync critical secrets to Vault." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }
}

/**
 * Deno serverless function handler.
 * Triggered via HTTP POST to fetch and process media for all configured Instagram accounts.
 * @param req The incoming HTTP Request object.
 * @returns An HTTP Response object.
 */
Deno.serve(async (req: Request) => {
  // Ensure the request method is POST
  if (req.method !== "POST") {
    return new Response("Method not allowed. Please use POST.", { status: 405 });
  }

  const startTime = Date.now(); // Record start time for performance metrics
  console.log(
    "Instagram media import function started at:",
    new Date(startTime).toISOString(),
  );

  // Initialize Supabase client using environment variables
  // SUPABASE_URL: Your Supabase project URL
  // SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key (has admin privileges)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: {
        persistSession: false, // Disable session persistence for server-side use
        autoRefreshToken: false, // Disable auto refresh token for server-side use
        detectSessionInUrl: false, // Disable detecting session in URL
      },
    },
  );

  // Sync environment variables to Supabase Vault (if needed)
  await syncToVault(supabase);

  try {
    // Fetch all Instagram accounts with their decrypted access tokens from the database
    // This assumes you have an RPC function 'get_decrypted_instagram_tokens' in Supabase
    const { data: igAccounts, error: accountsError } = await supabase
      .rpc("get_decrypted_instagram_tokens"); // Ensure this RPC exists and returns the expected structure

    if (accountsError) {
      console.error(
        "Failed to fetch Instagram accounts via RPC:",
        accountsError,
      );
      throw new Error(
        `Failed to fetch Instagram accounts: ${accountsError.message}`,
      );
    }

    // If no accounts are configured, return a success message indicating so
    if (!igAccounts?.length) {
      console.info("No Instagram accounts found to process.");
      return new Response(
        JSON.stringify({ message: "No Instagram accounts found to process." }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    console.info(`Found ${igAccounts.length} Instagram account(s) to process.`);

    // Process each Instagram account concurrently
    const results = await Promise.allSettled( // Use Promise.allSettled to handle individual failures
      igAccounts.map(
        async (
          account: {
            access_token: string;
            username: string;
            id: string;
            user_id: string; /* Added user_id based on usage in createIGMedia */
          },
        ) => {
          let processedMediaCount = 0;
          try {
            // Define the fields for the media list request (should match your initial request)
            const MEDIA_LIST_FIELDS = "id,caption,media_type,media_url,thumbnail_url,timestamp";
            // Construct the base URL for pagination using the current account's access token
            const baseUserMediaListUrl = `https://graph.instagram.com/me/media?fields=${MEDIA_LIST_FIELDS}&access_token=${account.access_token}`;

            // Initial URL to fetch the user's media from Instagram Graph API
            let nextUrl: string | null = baseUserMediaListUrl;

            console.log(
              `Processing account: ${account.username} (ID: ${account.id}, User_DB_ID: ${account.user_id})`,
            );

            // Paginate through media results as long as 'nextUrl' is available
            while (nextUrl) {
              console.log(
                `Fetching media page for ${account.username}: ${nextUrl}`,
              );
              const response = await fetchWithTimeout(nextUrl);

              if (!response.ok) {
                const errorBody = await response.json().catch(() =>
                  response.text()
                ); // Try to parse JSON, fallback to text
                console.error(
                  `Failed to fetch media page for ${account.username}. Status: ${response.status}`,
                  errorBody,
                );
                throw new Error(
                  `Failed to fetch media for ${account.username}. Status: ${response.status}. Response: ${
                    JSON.stringify(errorBody)
                  }`,
                );
              }

              const responseData = await response.json(); // Store raw response for Zod error context
              console.log(
                `API Response for ${account.username} page:`,
                JSON.stringify(responseData, null, 2).substring(0, 500) + "...", // Log snippet
              );

              try {
                // Validate the API response against the schema
                const validated = InstagramAPIResponseSchema.parse(
                  responseData,
                ); // Changed from response.json() to use stored responseData

                // Process each media item returned in the current page
                for (const ig_media of validated.data) {
                  console.log(
                    `Creating media for ${account.username}, media ID: ${ig_media.id}, account ID: ${account.id}, user ID: ${account.user_id}`,
                  );
                  await createIGMedia(
                    supabase,
                    ig_media.id,
                    account.id, // Pass the user's database ID (as per your log)
                    account.access_token, // Pass the original token, createIGMedia will handle refresh
                  );
                    console.log(
                        `Successfully processed media ID: ${ig_media.id} for account: ${account.username}`,
                    );
                  processedMediaCount++;
                }

                // Get the URL for the next page of results, if any
                if (validated.paging?.cursors?.after) {
                  nextUrl = `${baseUserMediaListUrl}&after=${validated.paging.cursors.after}`;
                } else {
                  nextUrl = null; // No more pages
                }
                
                if (nextUrl) {
                  console.log(
                    `Next page URL for ${account.username}: ${nextUrl}`,
                  );
                  // Implement rate limiting: wait for a short period before the next request
                  await new Promise((resolve) => setTimeout(resolve, 1000)); // e.g., 1 second delay
                } else {
                  console.log(`No more media pages for ${account.username}.`);
                }
              } catch (error) {
                if (error instanceof z.ZodError) {
                  console.error("Zod Validation Error:", error.issues);
                  console.error(
                    `Zod Validation Error while processing media page for ${account.username}:`,
                    JSON.stringify(
                      {
                        receivedData: responseData, // Provide the raw data that failed validation
                        validationErrors: error.issues,
                      },
                      null,
                      2,
                    ),
                  );

                } else {
                  console.error(
                    `Error processing media data for ${account.username}:`,
                    error,
                  );
                }
                throw error; // Re-throw to mark this account's processing as failed for this page
              }
            } // End of while loop (pagination)

            console.info(
              `Successfully processed ${processedMediaCount} media items for account: ${account.username}`,
            );
            return {
              status: "fulfilled", // Explicitly set status for Promise.allSettled compatibility
              account: account.username,
              processed: processedMediaCount,
            };
          } catch (error) {
            console.error(
              `Error processing account ${account.username}:`,
              error,
            );
            // Return a structured error object for Promise.allSettled
            return {
              status: "rejected",
              account: account.username,
              error: error instanceof Error ? error.message : String(error),
              processed: processedMediaCount, // Include count of media processed before failure
            };
          }
        },
      ),
    ); // End of Promise.allSettled

    // Filter out successfully processed accounts and failed accounts
    const successfulResults = results.filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    const failedResults = results.filter((r) => r.status === "rejected").map(
      (r) => r.reason || r.status,
    ); // `reason` for rejections

    if (failedResults.length > 0) {
      console.error(
        "One or more accounts failed during processing:",
        JSON.stringify(failedResults, null, 2),
      );
    }

    const totalProcessedCount = successfulResults.reduce((sum, r) =>
      sum + (r?.processed || 0), 0) +
      failedResults.reduce((sum, r) => sum + (r?.processed || 0), 0);

    console.log(
      "Instagram media import function finished at:",
      new Date().toISOString(),
    );
    const processingTime = Date.now() - startTime;
    console.log("Total processing time:", processingTime, "ms");

    // Return a summary response
    return new Response(
      JSON.stringify({
        success: failedResults.length === 0, // Overall success if no accounts failed entirely
        message:
          `Processed ${results.length} accounts. ${successfulResults.length} succeeded, ${failedResults.length} failed. Total media items considered: ${totalProcessedCount}.`,
        stats: {
          accountsProcessed: results.length,
          successfulAccounts: successfulResults.length,
          failedAccounts: failedResults.length,
          totalMediaItemsAttempted: totalProcessedCount,
          processingTime: processingTime,
        },
        details: results.map((r) =>
          r.status === "fulfilled" ? r.value : r.reason
        ), // Provide details of each account
      }),
      {
        status: 200, // Consider returning 207 Multi-Status if there are partial failures
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Catch any critical errors that occur outside the account processing loop
    console.error("Critical error in Instagram media import function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error instanceof Error
          ? error.message
          : "An unknown critical error occurred.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});