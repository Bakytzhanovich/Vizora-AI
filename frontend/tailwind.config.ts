import type { Config } from "tailwindcss";

// Reads a "R G B" CSS variable (see globals.css) so each named color still
// composes with Tailwind's opacity modifier, e.g. bg-accent/10. Swapping
// html[data-theme] flips the variables; class names never need dark:/light:
// variants.
function withOpacity(variable: string) {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `rgb(var(${variable}))`
      : `rgb(var(${variable}) / ${opacityValue})`;
}

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Cast: Tailwind has supported function-form colors (for opacity-modifier
      // composability) since v3.0, but @types/tailwindcss's Config type only
      // declares string/nested-object values — this is a type-defs gap, not a
      // runtime issue, since Tailwind's PostCSS plugin reads the plain JS
      // object and doesn't go through this type at all.
      colors: {
        bg: withOpacity("--color-bg"),
        card: withOpacity("--color-card"),
        border: withOpacity("--color-border"),
        "border-hover": withOpacity("--color-border-hover"),
        accent: withOpacity("--color-accent"),
        "accent-hover": withOpacity("--color-accent-hover"),
        "accent-light": withOpacity("--color-accent-light"),
        teal: withOpacity("--color-teal"),
        primary: withOpacity("--color-primary"),
        secondary: withOpacity("--color-secondary"),
        error: withOpacity("--color-error"),
        warning: withOpacity("--color-warning"),
      } as unknown as Record<string, string>,
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
