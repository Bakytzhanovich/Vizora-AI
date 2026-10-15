"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme, type Theme } from "@/context/ThemeContext";

const THEMES: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
  { value: "dark", icon: Moon, labelKey: "common.theme_dark" },
  { value: "light", icon: Sun, labelKey: "common.theme_light" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation("common");

  return (
    <div className="flex items-center gap-1 bg-border rounded-lg p-1">
      {THEMES.map(({ value, icon: Icon, labelKey }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-label={t(labelKey)}
          aria-pressed={theme === value}
          className={`flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium transition-all duration-200 ${
            theme === value ? "bg-accent text-white" : "text-secondary hover:text-primary"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
