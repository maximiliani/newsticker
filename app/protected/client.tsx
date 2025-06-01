"use client";

import { InfoIcon } from "lucide-react";
import {InstagramAccountsManager} from "@/features/instagram/components/instagram-accounts-manager";
import {InstagramAccount} from "@/types";

interface DashboardClientProps {
    fullName: string;
    instagramAccounts: Array<{
        id: string;
        username: string;
        profile_image_url: string | null;
    }> | [];
    userId: string;
}

export function DashboardClient({
    fullName,
    instagramAccounts,
    userId
}: DashboardClientProps) {
    return (
        <>
            <div className="w-full">
                <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
                    <InfoIcon size="16" strokeWidth={2}/>
                    This is a protected page that you can only see as an authenticated user
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <h2 className="font-extrabold text-2xl">Welcome, {fullName}!</h2>

                <InstagramAccountsManager
                    userId={userId}
                    initialAccounts={instagramAccounts as InstagramAccount[]}
                />
            </div>
        </>
    );
}