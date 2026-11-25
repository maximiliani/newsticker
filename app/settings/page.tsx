"use client";
import {useEffect, useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import {User} from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
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
    const t = useTranslations("Dashboard");
    const tc = useTranslations("Common");
    const searchParams = useSearchParams();

    // State management
    const [user, setUser] = useState<User | null>(null);
    const [fullName, setFullName] = useState<string>("");
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<
        { key: "notAuthenticated" | "loadError" | "permissionError" } | { message: string } | null
    >(null);

    useEffect(() => {
        async function fetchDashboardData() {
            try {
                setIsLoading(true);
                setError(null);

                const supabase = createClient();
                const {data: {user}} = await supabase.auth.getUser();

                if (!user) {
                    setError({ key: "notAuthenticated" });
                    return;
                }

                setUser(user);

                // Get user's name from metadata or use a default
                const userName = user?.user_metadata?.full_name || "";
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
                setError({ key: "loadError" });
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
            setError(!message || message === 'You do not have permission to access this page'
                ? { key: "permissionError" }
                : { message });
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
                    <CardTitle>{tc("error")}</CardTitle>
                    <CardDescription>{"key" in error ? t(error.key) : error.message}</CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-center">
                    <Link href="/settings">
                        <Button variant="outline">{t("tryAgain")}</Button>
                    </Link>
                </CardFooter>
            </Card>
        );
    }

    return (
        <div>
            <PageHeading
                heading={t("welcome", { name: fullName || t("defaultUser") })}
                text={t("description")}
            />

            <div className="mt-8">
                <AdminDashboardCards/>
            </div>
        </div>
    );
}
