"use client";
import {useEffect, useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import {User} from "@supabase/supabase-js";
import {PageHeading} from "@/components/ui/page-heading";
import {Card, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {createClient} from "@/lib/supabase/client";
import {InstagramService} from "@/features/instagram/services/instagram-service";
import {UserService} from "@/features/users/services/user-service";
import {logError} from "@/lib/utils/error-handling";
import {AdminDashboardCards} from "@/features/admin/components/admin-dashboard-cards";
import {InstagramAccount} from "@/types/instagram";

export const dynamic = 'force-dynamic';


/**
 * Dashboard page component that displays user's dashboard
 * with Instagram accounts and article management
 */
export default function DashboardPage() {
    const searchParams = useSearchParams();

    // State management
    const [user, setUser] = useState<User | null>(null);
    const [fullName, setFullName] = useState<string>("User");
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchDashboardData() {
            try {
                setIsLoading(true);
                setError(null);

                const supabase = createClient();
                const {data: {user}} = await supabase.auth.getUser();

                if (!user) {
                    setError("User not authenticated");
                    return;
                }

                setUser(user);

                // Get user's name from metadata or use a default
                const userName = user?.user_metadata?.full_name || "User";
                setFullName(userName);

                // Fetch Instagram accounts and admin status in parallel
                const [instagramAccountsResult, isAdminResult] = await Promise.allSettled([
                    InstagramService.getAccountsByUserId(user.id),
                    UserService.isCurrentUserAdmin()
                ]);

                // Handle Instagram accounts result
                if (instagramAccountsResult.status === 'fulfilled') {
                    setInstagramAccounts(instagramAccountsResult.value);
                } else {
                    logError(instagramAccountsResult.reason, 'DashboardPage.fetchInstagramAccounts');
                    setInstagramAccounts([]);
                }

                // Handle admin status result
                if (isAdminResult.status === 'fulfilled') {
                    setIsAdmin(isAdminResult.value);
                } else {
                    logError(isAdminResult.reason, 'DashboardPage.fetchAdminStatus');
                    setIsAdmin(false);
                }

            } catch (error) {
                logError(error, 'DashboardPage.fetchDashboardData');
                setError("Failed to load dashboard data");
            } finally {
                setIsLoading(false);
            }
        }

        fetchDashboardData();
    }, []);

    // Handle error parameter in URL
    useEffect(() => {
        if (searchParams?.get('error') === 'permission') {
            const message = searchParams.get('message');
            const errorMessage = message ? decodeURIComponent(message) : 'You do not have permission to access that page.';
            setError(errorMessage);
        }
    }, [searchParams]);

    // Loading state
    if (isLoading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <Card className="mx-auto max-w-md">
                <CardHeader className="text-center">
                    <CardTitle>Error</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-center">
                    <Link href="/settings">
                        <Button variant="outline">Try Again</Button>
                    </Link>
                </CardFooter>
            </Card>
        );
    }

    return (
        <div>
            <PageHeading
                heading={`Welcome, ${fullName}!`}
                text="Manage your account settings, profile, and more"
            />

            <div className="mt-8">
                <AdminDashboardCards/>
            </div>
        </div>
    );
}
