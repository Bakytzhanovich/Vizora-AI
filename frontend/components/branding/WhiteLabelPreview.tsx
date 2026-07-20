import { VizoraMark } from "@/components/VizoraMark";

interface Props {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
}

export function WhiteLabelPreview({ name, logoUrl, primaryColor }: Props) {
  return (
    <div className="bg-[#0A0A0F] rounded-2xl p-4 border border-gray-700">
      <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Предпросмотр</p>

      {/* Simulated navbar */}
      <div className="bg-[#0A0A0F] border-b border-[#1E1E2E] px-4 py-3 flex items-center justify-between rounded-t-xl mb-3">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="w-7 h-7 rounded-lg object-cover" />
          ) : (
            <VizoraMark className="h-7 w-7" />
          )}
          <span className="text-[#F0F0FF] font-bold text-sm">{name || "Vizora AI"}</span>
        </div>
        <span className="text-xs text-[#8B8BA7]">Выйти</span>
      </div>

      {/* Simulated progress bar */}
      <div className="px-2 mb-3">
        <div className="flex justify-between text-xs text-[#8B8BA7] mb-1.5">
          <span>Прогресс подготовки</span>
          <span style={{ color: primaryColor }}>45%</span>
        </div>
        <div className="h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: "45%", backgroundColor: primaryColor }}
          />
        </div>
      </div>

      {/* Simulated button */}
      <div className="px-2">
        <div
          className="text-center py-2 rounded-xl text-white text-xs font-semibold"
          style={{ backgroundColor: primaryColor }}
        >
          AI Помощник →
        </div>
      </div>

      {/* Powered by */}
      <p className="text-[10px] text-[#8B8BA7]/40 text-right mt-2">Powered by Vizora AI</p>
    </div>
  );
}
