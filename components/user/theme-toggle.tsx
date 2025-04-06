"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex w-full items-center"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      {theme === "light" ? (
        <>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark mode</span>
        </>
      ) : (
        <>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light mode</span>
        </>
      )}
    </div>
  );
} 