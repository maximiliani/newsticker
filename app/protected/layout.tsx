export const dynamic = 'force-dynamic'

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Protected layout that requires authentication
 * Redirects to sign-in page if user is not authenticated
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return redirect("/sign-in");
        }

        return (
            <div className="flex-1 w-full flex flex-col gap-12 p-4">
                {children}
            </div>
        );
    } catch (error) {
        console.error("Error in Dashboard layout:", error);
        return redirect("/sign-in?error=auth");
    }
}