// "use client";
// export const dynamic = 'force-dynamic';
//
// import {useSearchParams} from "next/navigation";
// import {createClient} from "@/lib/supabase/client";
// import {InstagramService} from "@/features/instagram/services/instagram-service";
// import {UserService} from "@/features/users/services/user-service";
// import {logError} from "@/lib/utils/error-handling";
// import {Button} from "@/components/ui/button";
// import Link from "next/link";
// import {FileTextIcon, Instagram, Users} from "lucide-react";
// import {useEffect, useState} from "react";
// import {User} from "@supabase/supabase-js";
//
// interface InstagramAccount {
//     id: string;
//     username: string;
//     profile_image_url: string | null;
// }
//
// /**
//  * Dashboard page component that displays user's dashboard
//  * with Instagram accounts and article management
//  */
// export default function DashboardPage() {
//     // Use Next.js's useSearchParams to access URL parameters
//     const searchParams = useSearchParams();
//
//     // State management
//     const [user, setUser] = useState<User | null>(null);
//     const [fullName, setFullName] = useState<string>("User");
//     const [isAdmin, setIsAdmin] = useState<boolean>(false);
//     const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
//     const [isLoading, setIsLoading] = useState<boolean>(true);
//     const [error, setError] = useState<string | null>(null);
//
//     useEffect(() => {
//         async function fetchDashboardData() {
//             try {
//                 setIsLoading(true);
//                 setError(null);
//
//                 const supabase = createClient();
//                 const {data: {user}} = await supabase.auth.getUser();
//
//                 if (!user) {
//                     setError("User not authenticated");
//                     return;
//                 }
//
//                 setUser(user);
//
//                 // Get user's name from metadata or use a default
//                 const userName = user?.user_metadata?.full_name || "User";
//                 setFullName(userName);
//
//                 // Fetch Instagram accounts and admin status in parallel
//                 const [instagramAccountsResult, isAdminResult] = await Promise.allSettled([
//                     InstagramService.getAccountsByUserId(user.id),
//                     UserService.isCurrentUserAdmin()
//                 ]);
//
//                 // Handle Instagram accounts result
//                 if (instagramAccountsResult.status === 'fulfilled') {
//                     setInstagramAccounts(instagramAccountsResult.value);
//                 } else {
//                     logError(instagramAccountsResult.reason, 'DashboardPage.fetchInstagramAccounts');
//                     // Continue rendering even if Instagram accounts fail to load
//                     setInstagramAccounts([]);
//                 }
//
//                 // Handle admin status result
//                 if (isAdminResult.status === 'fulfilled') {
//                     setIsAdmin(isAdminResult.value);
//                 } else {
//                     logError(isAdminResult.reason, 'DashboardPage.fetchAdminStatus');
//                     setIsAdmin(false);
//                 }
//
//             } catch (error) {
//                 logError(error, 'DashboardPage.fetchDashboardData');
//                 setError("Failed to load dashboard data");
//             } finally {
//                 setIsLoading(false);
//             }
//         }
//
//         fetchDashboardData();
//     }, []);
//
//     // Handle error parameter in URL
//     useEffect(() => {
//         if (searchParams?.get('error') === 'permission') {
//             const message = searchParams.get('message');
//             const errorMessage = message ? decodeURIComponent(message) : 'You do not have permission to access that page.';
//             setError(errorMessage);
//         }
//     }, [searchParams]);
//
//     // Loading state
//     if (isLoading) {
//         return (
//             <div className="container mx-auto px-4 py-12 flex flex-col items-center text-center">
//                 <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 dark:border-white"></div>
//                 <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Loading dashboard...</p>
//             </div>
//         );
//     }
//
//     // Error state
//     if (error) {
//         return (
//             <div className="container mx-auto px-4 py-12 flex flex-col items-center text-center">
//                 <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 max-w-md" role="alert">
//                     <span className="block sm:inline">{error}</span>
//                 </div>
//                 <Link href="/settings">
//                     <Button variant="outline">Try Again</Button>
//                 </Link>
//             </div>
//         );
//     }
//
//     return (
//         <div className="container mx-auto px-4 py-12 flex flex-col items-center text-center">
//             <h1 className="text-4xl font-extrabold mb-6 text-gray-900 dark:text-white">
//                 Welcome, {fullName}!
//             </h1>
//
//             {error && (
//                 <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 max-w-md" role="alert">
//                     <span className="block sm:inline">{error}</span>
//                 </div>
//             )}
//
//             <p className="text-lg text-gray-600 dark:text-gray-300 mb-10 max-w-md">
//                 Here you can manage your Instagram accounts and news articles with ease.
//             </p>
//
//             <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md sm:max-w-none flex-wrap justify-center">
//                 <Link href="/settings/instagram" className="w-full sm:w-auto">
//                     <Button className="w-full sm:w-auto px-8 py-4 text-lg" variant="outline">
//                         <Instagram className="mr-3 h-5 w-5" />
//                         Manage Instagram
//                     </Button>
//                 </Link>
//
//                 <Link href="/settings/articles" className="w-full sm:w-auto">
//                     <Button className="w-full sm:w-auto px-8 py-4 text-lg" variant="outline">
//                         <FileTextIcon className="mr-3 h-5 w-5" />
//                         Manage Articles
//                     </Button>
//                 </Link>
//
//                 {isAdmin && (
//                     <Link href="/settings/users" className="w-full sm:w-auto">
//                         <Button className="w-full sm:w-auto px-8 py-4 text-lg" variant="outline">
//                             <Users className="mr-3 h-5 w-5" />
//                             Manage Users
//                         </Button>
//                     </Link>
//                 )}
//             </div>
//         </div>
//     );
// }

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeading } from '@/components/ui/page-heading';
import { DashboardShell } from '@/components/shell';
import { AdminDashboardCards } from '@/features/admin/components/admin-dashboard-cards';

export default async function AdminDashboardPage() {
    // Check if the user is authenticated and admin
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Check if user is admin using server-side methods
    const { data: roleData } = await supabase
        .from('user_roles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

    const isAdmin = roleData?.is_admin === true;
    if (!isAdmin) redirect('/protected');

    return (
        <DashboardShell>
            <PageHeading
                heading="Admin Dashboard"
                text="Manage all aspects of your platform"
            />

            <AdminDashboardCards />
        </DashboardShell>
    );
}
