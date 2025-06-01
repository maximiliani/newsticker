"use client";

import { InstagramIcon, NewspaperIcon, UserPen, UsersIcon } from "lucide-react";
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
    }
];

export function AdminDashboardCards() {
    return (
        <div className="grid gap-8 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr max-w-full overflow-hidden">
            {cardData.map((card, index) => (
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