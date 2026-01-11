"use client";
import {createClient} from "@/lib/supabase/client";
import {Button} from "@/components/ui/button";
import {RefreshCcwIcon} from "lucide-react";

export default function RefreshInstagramFeedsButton() {
    // Calls our Next.js API route which triggers a Postgres stored procedure
    const handleRefresh = async () => {
        try {
            const res = await fetch('/api/features/instagram/refresh', {
                method: 'POST'
            });
            if (!res.ok) {
                const txt = await res.text();
                console.error("Error refreshing feeds:", txt);
                alert("Failed to refresh feeds. Please try again later.");
                return;
            }
            const json = await res.json();
            console.debug("Feeds refreshed successfully:", json);
            alert("Feeds refreshed successfully!");
        } catch (error) {
            console.error("Error refreshing feeds:", error);
        }
    };

    return (
        <Button size="sm" className="flex items-center gap-2" variant="outline" onClick={handleRefresh}>
            <RefreshCcwIcon className="h-4 w-4"/>
            Refresh All Feeds
        </Button>
    )
}