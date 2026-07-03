"use client";

interface ProgressIndicatorProps {
  current: number; // 0-based
  total: number;
}

export function ProgressIndicator({ current, total }: ProgressIndicatorProps) {
  const percent = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[#8B8BA7] text-xs shrink-0">
        Шаг {current + 1} из {total}
      </span>
      <div className="flex-1 h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg, #FF6B6B, #F59E0B)",
          }}
        />
      </div>
      <span className="text-[#8B8BA7] text-xs shrink-0">{percent}%</span>
    </div>
  );
}
