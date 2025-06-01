import {ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {
    Sidebar,
    SidebarContent, SidebarFooter,
    SidebarGroup,
    SidebarGroupContent, SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem, SidebarRail, SidebarSeparator,
    SidebarTrigger
} from '@/components/ui/sidebar';
import {ArrowLeftIcon, Calendar, FileTextIcon, Home, Instagram, UserPen} from "lucide-react";

export const dynamic = 'force-dynamic';

const items = [
    {
        title: "Settings Dashboard",
        url: "/settings",
        icon: Home,
    },
    {
        title: "Profile",
        url: "/settings/profile",
        icon: UserPen,
    },
    {
        title: "User Management",
        url: "/settings/users",
        icon: Calendar,
    },
    {
        title: "Instagram Feeds",
        url: "/settings/instagram",
        icon: Instagram,
    },
    {
        title: "News Articles",
        url: "/settings/articles",
        icon: FileTextIcon,
    },
]

interface SettingsLayoutProps {
    children: ReactNode;
}

export default async function SettingsLayout({children}: SettingsLayoutProps) {
    // Check if the user is authenticated
    const supabase = await createClient();

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) redirect('/login');

    return (
        <div className="flex-1 w-full flex flex-col md:flex-row">
            <Sidebar className="relative max-h-[calc(100dvh-196px)]" variant="floating" collapsible="icon">
                <SidebarHeader>
                    <SidebarMenuButton asChild>
                        <a href="/">
                            <ArrowLeftIcon/>
                            <span>Return to Dashboard</span>
                        </a>
                    </SidebarMenuButton>
                </SidebarHeader>
                <SidebarSeparator/>
                <SidebarContent className="bg-background font-medium text-lg">
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {items.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild>
                                            <a href={item.url}>
                                                <item.icon/>
                                                <span>{item.title}</span>
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenuButton asChild>
                        <a href="/">
                            <ArrowLeftIcon/>
                            <span>Return to Dashboard</span>
                        </a>
                    </SidebarMenuButton>
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>
            <div className="flex-1 flex flex-col min-h-0 bg-background">
                <div className="flex items-center justify-between p-4">
                    <SidebarTrigger/>
                </div>
                <main className="flex-1 p-6 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}