import { ImageIcon } from "lucide-react";

/** Reserved space for a real product screenshot/video, not yet produced.
 * Swap the contents for an actual <img>/<video> when one exists — the
 * aspect-ratio and outer classes are what the layout around it depends on,
 * keep those consistent if this gets replaced. */
export function ProductPreviewPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative w-full aspect-[4/5] sm:aspect-square lg:aspect-[4/5] rounded-2xl border border-border bg-card overflow-hidden flex items-center justify-center ${className}`}
    >
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-accent/[0.08] rounded-full blur-[100px]" />
      <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-xl border border-border bg-bg flex items-center justify-center">
          <ImageIcon size={22} strokeWidth={1.5} className="text-secondary" />
        </div>
        <p className="text-secondary/60 text-xs font-medium tracking-wide">
          Product screenshot placeholder
        </p>
      </div>
    </div>
  );
}
