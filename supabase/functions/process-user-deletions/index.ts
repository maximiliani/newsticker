// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.com/manual/examples/supabase-edge-functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        // Delete the user using admin API
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
