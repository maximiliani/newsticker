"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface MainNavProps {
  isAdmin?: boolean;
}

export function MainNav({ isAdmin = false }: MainNavProps) {
  const pathname = usePathname();

  const navItems = [
    { title: "Dashboard", href: "/protected" },
    { title: "Profile", href: "/protected/profile" },
    { title: "Instagram", href: "/protected/instagram" },
    { title: "Articles", href: "/protected/articles" },
  ];

  // Add admin link if user is admin
  if (isAdmin) {
    navItems.push({ title: "Admin", href: "/protected/admin" });
  }

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            pathname === item.href || pathname.startsWith(`${item.href}/`)
              ? "text-primary"
              : "text-muted-foreground"
          )}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
