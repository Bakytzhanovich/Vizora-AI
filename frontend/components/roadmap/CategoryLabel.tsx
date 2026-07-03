"use client";

interface Props {
  icon: string;
  label: string;
}

export function CategoryLabel({ icon, label }: Props) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-3 first:mt-0">
      <span className="text-base">{icon}</span>
      <span className="text-[#8B8BA7] text-xs font-bold uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-[#1E1E2E]" />
    </div>
  );
}
