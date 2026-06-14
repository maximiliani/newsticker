import Link from "next/link";
import {GitHubLogoIcon} from "@radix-ui/react-icons";
import {ThemeSwitcher} from "@/components/user/theme-switcher";

export function GlobalFooter() {
    return <footer
        className="w-full flex items-center justify-center border-t bg-background text-xs py-2 gap-2 mt-auto">
        <Link href="mailto:kontakt@inckmann.de">© 2025 Maximilian Inckmann</Link>
        <span>
            Powered by{" "}
            <Link
                href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
                target="_blank"
                className="font-bold hover:underline"
                rel="noreferrer"
            > Supabase</Link>
        </span>
        <a href="https://github.com/maximiliani" target="_blank" rel="noreferrer">
            <GitHubLogoIcon className="w-4 h-4"/>
        </a>
        <ThemeSwitcher/>
    </footer>;
}