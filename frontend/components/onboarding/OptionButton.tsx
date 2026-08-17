"use client";

import { motion } from "framer-motion";

interface Props {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: "purple" | "teal";
  className?: string;
}

export function OptionButton({ selected, onClick, children, accent = "purple", className = "" }: Props) {
  const activeClasses =
    accent === "teal"
      ? "bg-teal/10 border-teal text-primary"
      : "bg-accent/10 border-accent text-primary";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full min-h-[56px] flex items-center gap-3 px-5 py-4 rounded-xl border text-left font-semibold text-base transition-all duration-200 ${
        selected ? activeClasses : "border-border bg-card text-secondary hover:border-accent/40 hover:text-primary"
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}
