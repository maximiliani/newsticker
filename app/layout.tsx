import {Geist} from "next/font/google";
import {ThemeProvider} from "next-themes";
import "./globals.css";
import {GlobalHeader} from "@/components/globalHeader";
import {GlobalFooter} from "@/components/globalFooter";
import {cookies} from "next/headers";
import {SidebarProvider} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const defaultUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_URL ?
        `https://${process.env.NEXT_PUBLIC_URL}` :
        "http://localhost:3000";

export const metadata = {
    metadataBase: new URL(defaultUrl),
    title: "Newsticker",
    description: "A modern news aggregator",
};

const geistSans = Geist({
    display: "swap",
    subsets: ["latin"],
});

export default async function RootLayout({children}: Readonly<{ children: React.ReactNode; }>) {
    const sidebarStateCookie = cookieStore.get("sidebar_state")
    // Default to open if no cookie exists
    const defaultOpen = sidebarStateCookie ? sidebarStateCookie.value === "true" : true

    return (
        <html lang="en" className={geistSans.className} suppressHydrationWarning>
        <body className="bg-background text-foreground h-screen overflow-hidden">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
        >
            <SidebarProvider defaultOpen={defaultOpen}>
                <TooltipProvider>
                    <div className="flex flex-col w-full h-full">
                        <GlobalHeader/>
                        <main className="flex-1 overflow-y-auto w-full">
                            <div className="flex flex-col items-center min-h-full">
                                {children}
                            </div>
                        </main>
                        <GlobalFooter/>
                    </div>
                </TooltipProvider>
            </SidebarProvider>
        </ThemeProvider>
        </body>
        </html>
    );
}
