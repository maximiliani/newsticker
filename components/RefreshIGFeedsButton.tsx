"use client";
import {createClient} from "@/lib/supabase/client";
import {Button} from "@/components/ui/button";
import {RefreshCcwIcon} from "lucide-react";

export default function RefreshIGFeedsButton() {
    // Calls the fetchInstagramPostsAndStore edge function with Supabase Edge Runtime
    const handleRefresh = async () => {
        try {
            const supabase = createClient();
            const {data, error} = await supabase
                .functions
                .invoke('fetchInstagramPostsAndStore')
            if (error) {
                console.error("Error refreshing feeds:", error.message);
                alert("Failed to refresh feeds. Please try again later.");
            } else {
                console.debug("Feeds refreshed successfully:", data);
                alert("Feeds refreshed successfully!");
            }
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