"use client";

import {NewspaperIcon, UserPen, UsersIcon, Cpu, CalendarIcon} from "lucide-react";
import {InstagramIcon} from "@/components/icons/instagram-icon";
import {AdminCard} from "@/features/admin/components/admin_card_component";
import {useTranslations} from "next-intl";

export function AdminDashboardCards() {
    const t = useTranslations("Dashboard.cards");
    const isKiosk = process.env.NEXT_PUBLIC_KIOSK_MODE === 'true';

    const displayCards = [
        {
            icon: UserPen,
            title: t("profile.title"),
            description: t("profile.description"),
            content: t("profile.content"),
            buttonText: t("profile.button"),
            href: "/settings/profile"
        },
        {
            icon: UsersIcon,
            title: t("users.title"),
            description: t("users.description"),
            content: t("users.content"),
            buttonText: t("users.button"),
            href: "/settings/users"
        },
        {
            icon: InstagramIcon,
            title: t("instagram.title"),
            description: t("instagram.description"),
            content: t("instagram.content"),
            buttonText: t("instagram.button"),
            href: "/settings/instagram"
        },
        {
            icon: NewspaperIcon,
            title: t("articles.title"),
            description: t("articles.description"),
            content: t("articles.content"),
            buttonText: t("articles.button"),
            href: "/settings/articles"
        },
        {
            icon: CalendarIcon,
            title: t("calendar.title"),
            description: t("calendar.description"),
            content: t("calendar.content"),
            buttonText: t("calendar.button"),
            href: "/settings/calendar"
        }
    ];
    if (isKiosk) {
        displayCards.push({
            icon: Cpu,
            title: t("device.title"),
            description: t("device.description"),
            content: t("device.content"),
            buttonText: t("device.button"),
            href: "/settings/device"
        });
    }

    return (
        <div className="grid gap-8 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr max-w-full overflow-hidden">
            {displayCards.map((card) => (
                <AdminCard
                    key={card.href}
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