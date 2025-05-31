import {createClient} from "@/utils/supabase/server";
import {redirect} from "next/navigation";

export default async function DashboardLayout({children}: { children: React.ReactNode; }) {
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return redirect("/sign-in");
    }

    return (
        <div className="flex-1 w-full flex flex-col gap-12 p-4">
            {children}
        </div>
    );
}