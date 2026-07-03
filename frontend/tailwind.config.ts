import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0F",
        card: "#13131A",
        border: "#1E1E2E",
        accent: "#6C63FF",
        teal: "#00D4AA",
        primary: "#F0F0FF",
        secondary: "#8B8BA7",
        error: "#FF6B6B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #6C63FF 0%, #9C8BFF 100%)",
        "teal-gradient": "linear-gradient(135deg, #00D4AA 0%, #00B894 100%)",
        "hero-glow":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(108,99,255,0.3), transparent)",
      },
      boxShadow: {
        "accent-glow": "0 0 40px rgba(108,99,255,0.15)",
        "teal-glow": "0 0 40px rgba(0,212,170,0.15)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "count-up": "countUp 1s ease-out forwards",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
