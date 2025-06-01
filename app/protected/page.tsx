import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./client";
import ArticleManager from "@/features/articles/components/article-manager";
import { InstagramService } from "@/features/instagram/services/instagram-service";
import { Suspense } from "react";
import { logError } from "@/lib/utils/error-handling";

/**
 * Dashboard page component that displays user's dashboard
 * with Instagram accounts and article management
 */
export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get user's name from metadata or use a default
    const fullName = user?.user_metadata?.full_name || "User";

    // Default empty array for Instagram accounts
    let instagramAccounts: { id: string; username: string; profile_image_url: string | null; }[] = [];

    if (user) {
        try {
            // Fetch Instagram accounts for the user
            instagramAccounts = await InstagramService.getAccountsByUserId(user.id);
        } catch (error) {
            logError(error, 'DashboardPage.fetchInstagramAccounts');
            // Continue rendering even if Instagram accounts fail to load
        }
    }

    return (
        <>
            {/* Client component for user info and Instagram accounts */}
            <DashboardClient 
                fullName={fullName}
                instagramAccounts={instagramAccounts}
                userId={user?.id || ""}
            />

            {/* Article manager with suspense boundary for streaming */}
            <div className="mt-6">
                <Suspense fallback={<div className="text-center py-8">Loading articles...</div>}>
                    <ArticleManager />
                </Suspense>
            </div>
        </>
    );
}