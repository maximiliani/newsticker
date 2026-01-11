import {NextRequest, NextResponse} from "next/server";
import {createClient as createCookieAwareClient} from "@/lib/supabase/server";
import {createClient as createSupabaseServerClient} from "@supabase/supabase-js";

/**
 * DELETE endpoint to remove an Instagram account and all associated data
 * This endpoint is for user-initiated account deletions
 */
export async function DELETE(req: NextRequest) {
    const supabase = await createCookieAwareClient();

    try {
        // Authenticate user
        const {data: userRes, error: authError} = await supabase.auth.getUser();
        if (authError || !userRes.user) {
            return NextResponse.json({error: "Unauthorized"}, {status: 401});
        }

        const userId = userRes.user.id;

        // Get account ID from request
        const {searchParams} = new URL(req.url);
        const accountIdParam = searchParams.get("accountId");

        if (!accountIdParam) {
            return NextResponse.json({error: "Account ID is required"}, {status: 400});
        }

        const accountId = parseInt(accountIdParam, 10);
        if (isNaN(accountId)) {
            return NextResponse.json({error: "Invalid account ID"}, {status: 400});
        }

        // Check admin status
        const {data: isAdminData} = await supabase.rpc("check_is_admin");
        const isAdmin = !!isAdminData;

        // Verify ownership or admin access
        const {data: account, error: accountError} = await supabase
            .from("instagram_accounts")
            .select("id, user_id")
            .eq("id", accountId)
            .single();

        if (accountError || !account) {
            return NextResponse.json({error: "Account not found"}, {status: 404});
        }

        // Only allow deletion if user owns the account or is admin
        if (account.user_id !== userId && !isAdmin) {
            return NextResponse.json({error: "Forbidden"}, {status: 403});
        }

        // Setup service-role client to call deletion function
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json(
                {error: "Server configuration error"},
                {status: 500}
            );
        }

        const admin = createSupabaseServerClient(supabaseUrl, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Call the deletion function
        const {data: result, error: deleteError} = await admin.rpc(
            "delete_instagram_account_data",
            {p_id: accountId}
        );

        if (deleteError) {
            console.error("Failed to delete Instagram account:", deleteError);
            return NextResponse.json(
                {error: "Failed to delete account"},
                {status: 500}
            );
        }

        console.info("Instagram account deleted successfully:", result);

        return NextResponse.json({
            ok: true,
            message: "Account deleted successfully",
            stats: result
        });

    } catch (error: any) {
        console.error("Instagram account deletion error:", error);
        return NextResponse.json(
            {error: error?.message || "Unexpected error"},
            {status: 500}
        );
    }
}

