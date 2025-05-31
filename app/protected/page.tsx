import FetchDataSteps from "@/components/tutorial/fetch-data-steps";
import {createClient} from "@/utils/supabase/server";
import {InfoIcon} from "lucide-react";
import {redirect} from "next/navigation";
import {InstagramAccountsManager} from "@/components/instagram_accounts_manager";
import RefreshIGFeedsButton from "@/components/RefreshIGFeedsButton";

export default async function ProtectedPage() {
    const supabase = await createClient();

    const {
        data: {user},
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/sign-in");
    }

    // Get the full name from user metadata and Instagram accounts
    const fullName = user.user_metadata?.full_name || "User";
    const {data: instagramAccounts} = await supabase
        .from("instagram_accounts")
        .select("id, username, profile_image_url")
        .eq("user_id", user.id);

    return (
        <div className="flex-1 w-full flex flex-col gap-12 p-4">
            <div className="w-full">
                <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
                    <InfoIcon size="16" strokeWidth={2}/>
                    This is a protected page that you can only see as an authenticated user
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <h2 className="font-extrabold text-2xl">Welcome, {fullName}!</h2>

                <div className="bg-card rounded-lg p-6 border">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-xl">Instagram Accounts</h2>
                        <RefreshIGFeedsButton/>
                    </div>
                    <p className="text-muted-foreground mb-4">
                        Manage your connected Instagram accounts below. You can add, remove, or view details of your
                        accounts.
                    </p>
                    <InstagramAccountsManager
                        initialAccounts={instagramAccounts || []}
                        userId={user.id}
                    />
                </div>
            </div>

            <div>
                <h2 className="font-bold text-2xl mb-4">Next steps</h2>
                <FetchDataSteps/>
            </div>
        </div>
    );
}