import {Geist} from "next/font/google";
import {ThemeProvider} from "next-themes";
import "./globals.css";
import {GlobalHeader} from "@/components/globalHeader";
import {GlobalFooter} from "@/components/globalFooter";
import {cookies} from "next/headers";
import {SidebarProvider} from "@/components/ui/sidebar";

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
    const cookieStore = await cookies()
    const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

    return (
        <html lang="en" className={geistSans.className} suppressHydrationWarning>
        <body className="bg-background text-foreground overflow-y-auto">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
        >
            <SidebarProvider defaultOpen={defaultOpen}>
                <div className="flex flex-col w-full h-full">
                    <GlobalHeader/>
                    <div className="flex flex-col items-center overflow-auto">
                        {children}
                    </div>
                    <GlobalFooter/>
                </div>
            </SidebarProvider>
        </ThemeProvider>
        </body>
        </html>
    );
}
