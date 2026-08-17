"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/context/ThemeContext";

const THEMES: { value: Theme; icon: typeof Sun }[] = [
  { value: "dark", icon: Moon },
  { value: "light", icon: Sun },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 bg-border rounded-lg p-1">
      {THEMES.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
            theme === value ? "bg-accent text-white" : "text-secondary hover:text-primary"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
