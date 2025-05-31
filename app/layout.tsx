import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/user/header-auth";
import { ThemeSwitcher } from "@/components/user/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import "./globals.css";
import { Clock } from "@/components/Clock";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_URL ?
    `https://${process.env.NEXT_PUBLIC_URL}` :
    "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Next.js and Supabase Starter Kit",
  description: "The fastest way to build apps with Next.js and Supabase",
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-2 items-center">
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full flex justify-between items-center p-3 text-sm">
                  <h1 className="font-bold text-4xl">
                    <Link href={"/"}>Newsticker</Link>
                  </h1>
                  <Clock />
                  <div className="flex items-center gap-4">
                    {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                  </div>
                </div>
              </nav>
              {children}

              <footer className="w-full flex items-center justify-center border-t bg-background text-xs py-4 gap-2 mt-auto">
                <Link href="mailto:kontakt@inckmann.de">© 2025 Maximilian Inckmann</Link>
                <span>
                  Powered by{" "}
                  <a
                    href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
                    target="_blank"
                    className="font-bold hover:underline"
                    rel="noreferrer"
                  >
                    Supabase
                  </a>
                </span>
                <a href="https://github.com/maximiliani" target="_blank" rel="noreferrer">
                  <GitHubLogoIcon className="w-4 h-4" />
                </a>
                <ThemeSwitcher />
              </footer>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
