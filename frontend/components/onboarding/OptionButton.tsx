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
      ? "bg-[#00D4AA]/10 border-[#00D4AA] text-[#F0F0FF]"
      : "bg-[#6C63FF]/10 border-[#6C63FF] text-[#F0F0FF]";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full min-h-[56px] flex items-center gap-3 px-5 py-4 rounded-xl border text-left font-semibold text-base transition-all duration-200 ${
        selected ? activeClasses : "border-[#1E1E2E] bg-[#13131A] text-[#8B8BA7] hover:border-[#6C63FF]/40 hover:text-[#F0F0FF]"
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}
