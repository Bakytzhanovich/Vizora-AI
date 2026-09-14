import { ImageIcon } from "lucide-react";

/** Reserved space for a real product screenshot/video, not yet produced.
 * Swap the contents for an actual <img>/<video> when one exists — the
 * aspect-ratio and outer classes are what the layout around it depends on,
 * keep those consistent if this gets replaced. */
export function ProductPreviewPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative w-full aspect-[4/5] sm:aspect-square lg:aspect-[4/5] rounded-2xl border border-[#1E1E2E] bg-[#13131A] overflow-hidden flex items-center justify-center ${className}`}
    >
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#6C63FF]/[0.08] rounded-full blur-[100px]" />
      <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-xl border border-[#1E1E2E] bg-[#0A0A0F] flex items-center justify-center">
          <ImageIcon size={22} strokeWidth={1.5} className="text-[#8B8BA7]" />
        </div>
        <p className="text-[#8B8BA7]/60 text-xs font-medium tracking-wide">
          Product screenshot placeholder
        </p>
      </div>
    </div>
  );
}
