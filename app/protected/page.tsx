import {createClient} from "@/lib/supabase/server";
import {InstagramService} from "@/features/instagram/services/instagram-service";
import {logError} from "@/lib/utils/error-handling";
import {Button} from "@/components/ui/button";
import Link from "next/link";
import {FileTextIcon, Instagram} from "lucide-react";

/**
 * Dashboard page component that displays user's dashboard
 * with Instagram accounts and article management
 */
export default async function DashboardPage() {
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();

    // Get user's name from metadata or use a default
    const fullName = user?.user_metadata?.full_name || "User";

    // Default empty array for Instagram accounts (original logic, not directly used in this part of the UI)
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
        <div className="container mx-auto px-4 py-12 flex flex-col items-center text-center">
            <h1 className="text-4xl font-extrabold mb-6 text-gray-900 dark:text-white">
                Welcome, {fullName}!
            </h1>

            <p className="text-lg text-gray-600 dark:text-gray-300 mb-10 max-w-md">
                Here you can manage your Instagram accounts and news articles with ease.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md sm:max-w-none">
                <Link href="/protected/instagram" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto px-8 py-4 text-lg" variant="outline">
                        <Instagram className="mr-3 h-5 w-5" />
                        Manage Instagram
                    </Button>
                </Link>

                <Link href="/protected/articles" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto px-8 py-4 text-lg" variant="outline">
                        <FileTextIcon className="mr-3 h-5 w-5" />
                        Manage Articles
                    </Button>
                </Link>
            </div>
        </div>
    );
}