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
          <span className="text-teal text-xs font-bold">✓ Изучено</span>
        ) : (
          <>
            <div className="w-16 h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-teal rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-secondary text-xs">
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
        <span className="text-secondary">
          {completed} из {total} разделов
        </span>
        {isComplete && (
          <span className="text-teal font-bold">✓ Завершено</span>
        )}
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
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
