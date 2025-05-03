/// <reference lib="deno.ns" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

serve(async (req: Request) => {
    try {
        if (req.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const body = await req.json();

        const {
            username,
            user_id,
            profile_image_url,
            access_token,
            access_token_expires_at, // ISO string or epoch; optional
        } = body;

        if (!username || !user_id || !access_token) {
            return new Response(
                JSON.stringify({ error: "username, user_id and access_token are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        // Upsert credentials into instagram_accounts table
        const { data, error } = await supabase
            .from("instagram_accounts")
            .upsert({
                user_id,
                username,
                profile_image_url: profile_image_url || null,
                access_token,
                access_token_expires_at: access_token_expires_at ? new Date(access_token_expires_at) : null,
            })
            .eq("user_id", user_id)
            .select()
            .single();

        if (error) {
            console.error("Supabase upsert error:", error);
            return new Response(
                JSON.stringify({ error: "Failed to upsert Instagram credentials" }),
                { status: 500, headers: { "Content-Type": "application/json" } },
            );
        }

        return new Response(JSON.stringify({ message: "Instagram credentials added/updated", data }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
});
