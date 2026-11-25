"use client";
import {createClient} from "@/lib/supabase/client";
import {Button} from "@/components/ui/button";
import {RefreshCcwIcon} from "lucide-react";
import {useTranslations} from "next-intl";
import {useEffect, useState} from "react";

export default function RefreshInstagramFeedsButton() {
    const t = useTranslations("Instagram");
    const [isAdmin, setIsAdmin] = useState(false);
    useEffect(() => {
        const supabase = createClient();
        let active = true;
        const update = async (hasSession: boolean) => {
            if (!hasSession) {
                if (active) setIsAdmin(false);
                return;
            }
            const {data, error} = await supabase.rpc("check_is_admin");
            if (error) console.error("Failed to check administrator status:", error);
            if (active) setIsAdmin(!error && data === true);
        };
        const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
            // Defer database requests outside the auth callback.
            setTimeout(() => { if (active) void update(!!session); }, 0);
        });
        return () => { active = false; subscription.unsubscribe(); };
    }, []);
    // Calls our Next.js API route which triggers a Postgres stored procedure
    const handleRefresh = async () => {
        try {
            const res = await fetch('/api/features/instagram/refresh', {
                method: 'POST'
            });
            if (!res.ok) {
                const txt = await res.text();
                console.error("Error refreshing feeds:", txt);
                alert(t("refreshError"));
                return;
            }
            const json = await res.json();
            console.debug("Feeds refreshed successfully:", json);
            alert(t("refreshSuccess"));
        } catch (error) {
            console.error("Error refreshing feeds:", error);
            alert(t("refreshError"));
        }
    };

    if (!isAdmin) return null;
    return (
        <Button size="sm" className="flex items-center gap-2" variant="outline" onClick={handleRefresh}>
            <RefreshCcwIcon className="h-4 w-4"/>
            {t("refreshAll")}
        </Button>
    )
}