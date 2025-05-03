import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
    try {
        if (req.method !== "DELETE") {
            return new Response("Method not allowed", { status: 405 });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Parse query params for identifying credential to delete
        const url = new URL(req.url);
        const user_id = url.searchParams.get("user_id");
        const username = url.searchParams.get("username");

        if (!user_id && !username) {
            return new Response(
                JSON.stringify({ error: "Query parameter user_id or username is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        let query = supabase.from("instagram_accounts").delete();

        if (user_id) {
            query = query.eq("user_id", user_id);
        } else if (username) {
            query = query.eq("username", username);
        }

        const { error } = await query;

        if (error) {
            console.error("Supabase delete error:", error);
            return new Response(
                JSON.stringify({ error: "Failed to delete Instagram credentials" }),
                { status: 500, headers: { "Content-Type": "application/json" } },
            );
        }

        return new Response(
            JSON.stringify({ message: "Instagram credentials deleted successfully" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        );
    } catch (error) {
        console.error("Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
});
