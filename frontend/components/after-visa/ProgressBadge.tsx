"use client";

interface ProgressBadgeProps {
  completed: number;
  total: number;
  pct: number;
  size?: "sm" | "md";
}

export function ProgressBadge({ completed, total, pct, size = "md" }: ProgressBadgeProps) {
  const isComplete = completed === total && total > 0;

  if (size === "sm") {
    return (
      <div className="flex items-center gap-1.5">
        {isComplete ? (
          <span className="text-[#00D4AA] text-xs font-bold">✓ Изучено</span>
        ) : (
          <>
            <div className="w-16 h-1 bg-[#1E1E2E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00D4AA] rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[#8B8BA7] text-xs">
              {completed}/{total}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8B8BA7]">
          {completed} из {total} разделов
        </span>
        {isComplete && (
          <span className="text-[#00D4AA] font-bold">✓ Завершено</span>
        )}
      </div>
      <div className="h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isComplete
              ? "#00D4AA"
              : "linear-gradient(90deg, #00D4AA, #00B894)",
          }}
        />
      </div>
    </div>
  );
}
