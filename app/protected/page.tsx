import { createClient } from "@/utils/supabase/server";
import { DashboardClient } from "./client";
import ArticleManager from "@/components/ArticleManager/ArticleManager";

export default async function DashboardPage() {
    const supabase = await createClient();
    
    // Fix: Add await here
    const { data: { user } } = await supabase.auth.getUser();
    const fullName = user?.user_metadata?.full_name || "User";
    
    const { data: instagramAccounts } = await supabase
        .from("instagram_accounts")
        .select("id, username, profile_image_url")
        .eq("user_id", user?.id);

    return (
        <>
            <DashboardClient 
                fullName={fullName}
                instagramAccounts={instagramAccounts || []}
                userId={user?.id || ""}
            />
            
            {/* Add ArticleManager here as a server component */}
            <div className="mt-6">
                <ArticleManager />
            </div>
        </>
    );
}