import { Star } from "lucide-react";

/** Compact, clearly-visible seal badge — evokes an official document stamp
 * without leaning on flag colors or kitsch. Meant to sit next to the
 * wordmark, not fade into the background. */
export function OfficialSeal({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative text-[#6C63FF] pointer-events-none select-none shrink-0 ${className}`}>
      <div className="absolute inset-0 rounded-full border-2 border-current opacity-60" />
      <div className="absolute inset-[3px] rounded-full border border-dashed border-current opacity-40" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Star size={14} fill="currentColor" strokeWidth={1} />
      </div>
    </div>
  );
}
