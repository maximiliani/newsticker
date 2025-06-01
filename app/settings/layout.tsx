import {DashboardNav} from "@/components/dashboard-nav";
import {ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {UserService} from '@/features/users/services/user-service';

export const dynamic = 'force-dynamic';

const adminNavItems = [
    {
        title: 'Dashboard',
        href: '/settings',
        icon: 'HomeIcon',
    },
    {
        title: 'Profile',
        href: '/settings/profile',
        icon: 'UserPen',
    },
    {
        title: 'User Management',
        href: '/settings/users',
        icon: 'UsersIcon',
    },
    {
        title: 'Instagram Feeds',
        href: '/settings/instagram',
        icon: 'InstagramIcon',
    },
    {
        title: 'News Articles',
        href: '/settings/articles',
        icon: 'NewspaperIcon',
    },
];

interface SettingsLayoutProps {
    children: ReactNode;
}

export default async function SettingsLayout({children}: SettingsLayoutProps) {
    // Check if the user is authenticated
    const supabase = await createClient();

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Check if user is admin for navigation
    let isAdmin = false;
    try {
        isAdmin = await UserService.isCurrentUserAdmin();
    } catch (error) {
        console.error('Error checking admin status:', error);
        // Continue even if admin check fails
    }

    return (
        <div className="flex min-h-screen flex-col">
            <div
                className="flex-1 items-start md:grid md:grid-cols-[220px_1fr] md:gap-6 lg:grid-cols-[240px_1fr] lg:gap-10">
                <aside
                    className="fixed top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 overflow-y-auto border-r md:sticky md:block">
                    <div className="py-6 pr-6 lg:py-8">
                        <DashboardNav items={adminNavItems}/>
                    </div>
                </aside>
                <main className="flex w-full flex-col overflow-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}