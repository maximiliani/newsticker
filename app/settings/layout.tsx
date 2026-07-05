import {ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {getTranslations} from 'next-intl/server';
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
import {
    ArrowLeftIcon,
    Calendar,
    Cpu,
    FileTextIcon,
    Home,
    Monitor,
    UserPen,
    Users,
    Settings2
} from "lucide-react";
import {Instagram} from "@/components/icons/instagram-icon";

export const dynamic = 'force-dynamic';

interface SettingsLayoutProps {
    children: ReactNode;
}

export default async function SettingsLayout({children}: SettingsLayoutProps) {
    const t = await getTranslations("Sidebar");
    // Check if the user is authenticated
    const supabase = await createClient();

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: isAdmin } = await supabase.rpc("check_is_admin");

    const isKiosk = process.env.NEXT_PUBLIC_KIOSK_MODE === 'true';

    const sidebarItems = [
        {
            title: t("dashboard"),
            url: "/settings",
            icon: Home,
        },
        {
            title: t("profile"),
            url: "/settings/profile",
            icon: UserPen,
        },
        {
            title: t("users"),
            url: "/settings/users",
            icon: Users,
        },
        {
            title: t("instagram"),
            url: "/settings/instagram",
            icon: Instagram,
        },
        {
            title: t("calendar"),
            url: "/settings/calendar",
            icon: Calendar,
        },
        {
            title: t("articles"),
            url: "/settings/articles",
            icon: FileTextIcon,
        },
    ];

    if (isAdmin) {
        sidebarItems.push({
            title: t("general"),
            url: "/settings/general",
            icon: Settings2,
        });
    }

    if (isKiosk && isAdmin) {
        sidebarItems.push({
            title: t("device"),
            url: "/settings/device",
            icon: Cpu,
        });
    }

    return (
        <div className="flex-1 w-full flex flex-col md:flex-row">
            <Sidebar className="relative h-full" variant="sidebar" collapsible="icon">
                <SidebarHeader>
                    <SidebarMenuButton asChild>
                        <a href="/">
                            <ArrowLeftIcon/>
                            <span>{t("return")}</span>
                        </a>
                    </SidebarMenuButton>
                </SidebarHeader>
                <SidebarSeparator/>
                <SidebarContent className="bg-background font-medium text-lg">
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {sidebarItems.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild>
                                            <a href={item.url} target={item.url.startsWith('http') ? "_blank" : undefined} rel={item.url.startsWith('http') ? "noopener noreferrer" : undefined}>
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