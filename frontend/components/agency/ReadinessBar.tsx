interface Props {
  value: number;
  label?: string;
  showValue?: boolean;
}

function getColor(value: number) {
  if (value >= 70) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-400";
  return "bg-red-400";
}

function getTextColor(value: number) {
  if (value >= 70) return "text-emerald-600";
  if (value >= 40) return "text-amber-600";
  return "text-red-500";
}

export function ReadinessBar({ value, label, showValue = true }: Props) {
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between mb-1 text-xs">
          {label && <span className="text-gray-500">{label}</span>}
          {showValue && <span className={`font-bold ${getTextColor(value)}`}>{value}%</span>}
        </div>
      )}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${getColor(value)}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
