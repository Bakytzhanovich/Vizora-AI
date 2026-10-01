// Colour by what the level means for the visa interview, where B1 is the
// usual bar: below it needs work, B1 is enough, above is comfortable.
function levelTone(level: string) {
  const base = level.replace("+", "");
  if (base === "A1" || base === "A2") return "text-red-600 bg-red-50";
  if (base === "B1") return "text-amber-700 bg-amber-50";
  return "text-emerald-700 bg-emerald-50";
}

export function EnglishLevelBadge({ test }: { test?: { level: string; tested_at: string | null } | null }) {
  if (!test) return <span className="text-xs text-gray-400">Не проверял</span>;
  return (
    <div>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${levelTone(test.level)}`}>{test.level}</span>
      {test.tested_at && (
        <span className="block text-[11px] text-gray-400 mt-0.5">
          {new Date(test.tested_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
        </span>
      )}
    </div>
  );
}
