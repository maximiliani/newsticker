"use client";

import {NewspaperIcon, UserPen, UsersIcon, Cpu, CalendarIcon} from "lucide-react";
import {InstagramIcon} from "@/components/icons/instagram-icon";
import {AdminCard} from "@/features/admin/components/admin_card_component";

const cardData = [
    {
        icon: UserPen,
        title: "Your Profile",
        description: "Update your personal information and profile details",
        content: "Manage your account settings, update your profile picture, and change your password. You can also delete your account if needed.",
        buttonText: "Modify your profile",
        href: "/settings/profile"
    },
    {
        icon: UsersIcon,
        title: "User Management",
        description: "Manage user accounts and permissions",
        content: "View, edit, or delete user profiles. Manage admin access and user roles.",
        buttonText: "Manage Users",
        href: "/settings/users"
    },
    {
        icon: InstagramIcon,
        title: "Instagram Feeds",
        description: "Manage all Instagram content",
        content: "Review and delete Instagram posts from all users across the platform.",
        buttonText: "Manage Instagram",
        href: "/settings/instagram"
    },
    {
        icon: NewspaperIcon,
        title: "News Articles",
        description: "Manage all news articles",
        content: "View, edit, or delete news articles from all users across the platform.",
        buttonText: "Manage Articles",
        href: "/settings/articles"
    },
    {
        icon: CalendarIcon,
        title: "Calendar Subscriptions",
        description: "Manage all calendar subscriptions",
        content: "View, edit, or delete calendar subscriptions from all users across the platform.",
        buttonText: "Manage calendar subscriptions",
        href: "/settings/calendar"
    }
];

export function AdminDashboardCards() {
    const isKiosk = process.env.NEXT_PUBLIC_KIOSK_MODE === 'true';

    const displayCards = [...cardData];
    if (isKiosk) {
        displayCards.push({
            icon: Cpu,
            title: "Device Management",
            description: "Monitor and control this device",
            content: "Update hostname, monitor system health (CPU, RAM, Disk), and perform power actions like reboot or shutdown.",
            buttonText: "Manage Device",
            href: "/settings/device"
        });
    }

    return (
        <div className="grid gap-8 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr max-w-full overflow-hidden">
            {displayCards.map((card, index) => (
                <AdminCard
                    key={index}
                    icon={card.icon}
                    title={card.title}
                    description={card.description}
                    content={card.content}
                    buttonText={card.buttonText}
                    href={card.href}
                />
            ))}
        </div>
    );
}