interface ChartItem {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  items: ChartItem[];
  max: number;
  unit?: string;
}

export function AnalyticsChart({ items, max, unit = "" }: Props) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = max > 0 ? Math.round((item.value / max) * 100) : 0;
        return (
          <div key={item.label}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-bold text-gray-900">
                {item.value}{unit}
              </span>
            </div>
            <div className="h-7 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-700 ease-out flex items-center px-2"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color || "#2563EB",
                  minWidth: item.value > 0 ? "2rem" : "0",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
