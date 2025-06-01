import {InstagramAccountsManager} from "@/features/instagram/components/instagram-accounts-manager";
import {InstagramAccount} from "@/types";
import {createClient} from "@/lib/supabase/server";
import {InstagramService} from "@/features/instagram/services/instagram-service";
import {logError} from "@/lib/utils";

export default async function Page() {
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
            <div className="flex flex-col gap-6">
                <h2 className="font-extrabold text-2xl">Welcome, {fullName}!</h2>

                <InstagramAccountsManager
                    userId={user?.id || ""}
                    initialAccounts={instagramAccounts as InstagramAccount[]}
                />
            </div>
        </>
    );
}