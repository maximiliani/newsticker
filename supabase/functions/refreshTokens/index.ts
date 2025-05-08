// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import {createClient, SupabaseClient} from "jsr:@supabase/supabase-js@2"

interface RequestBody {
  userIds: string[];
}

interface IGUser {
  id: string;
  access_token: string;
  user_id?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

// Function to refresh Instagram token based on the unexpired access token
async function refreshInstagramToken(accessToken: string): Promise<TokenResponse> {
  const response = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`);
  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }
  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_in: data.expires_in
  };
}

// Function to process users and update their access tokens
async function processUsers(supabase: SupabaseClient, users: IGUser[]): Promise<void> {
  for (const user of users) {
    try {
      const tokenData = await refreshInstagramToken(user.access_token);
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      await supabase
          .from('instagram_accounts')
          .update({
            access_token: tokenData.access_token,
            token_expires_at: expiresAt.toISOString()
          })
          .eq('id', user.id);
    } catch (error) {
      console.error(`Failed to refresh token for user ${user.id}:`, error);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", {status: 405})
  }

  try {
    const {userIds} = await req.json() as RequestBody;
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {auth: {persistSession: false}}
    );

    const {data: users, error} = await supabase
        .from('instagram_accounts')
        .select('id, access_token, user_id')
        .in('id', userIds);

    if (error) throw error;
    if (!users) throw new Error('No users found');

    await processUsers(supabase, users);

    return new Response(JSON.stringify({success: true}), {
      status: 200,
      headers: {"Content-Type": "application/json"}
    });
  } catch (error) {
    return new Response(JSON.stringify({error: error instanceof Error ? error.message : 'An unknown error occurred'}), {
      status: 400,
      headers: {"Content-Type": "application/json"}
    });
  }
});
