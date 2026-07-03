"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface Props {
  icon: string;
  title: string;
  locked?: boolean;
  href?: string | null;
  index: number;
}

export function ModuleCard({ icon, title, locked = true, href, index }: Props) {
  const router = useRouter();

  const handleClick = () => {
    if (!locked && href) router.push(href);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      onClick={handleClick}
      className={`relative bg-[#13131A] border rounded-2xl p-5 flex flex-col gap-3 overflow-hidden transition-all duration-200 ${
        locked
          ? "border-[#1E1E2E] opacity-60"
          : "border-[#6C63FF]/30 hover:border-[#6C63FF] hover:bg-[#6C63FF]/5 cursor-pointer shadow-lg shadow-[#6C63FF]/5"
      }`}
    >
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-[#F0F0FF] font-semibold text-sm">{title}</div>
        {locked ? (
          <div className="text-[#8B8BA7] text-xs mt-1 flex items-center gap-1">
            <span>🔒</span> Скоро
          </div>
        ) : (
          <div className="text-[#6C63FF] text-xs mt-1 flex items-center gap-1">
            <span>→</span> Открыть
          </div>
        )}
      </div>
      {locked && <div className="absolute inset-0 bg-[#0A0A0F]/20 rounded-2xl" />}
    </motion.div>
  );
}
