import Image from "next/image";
import { VizoraMark } from "@/components/VizoraMark";

interface Props {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  isWhiteLabel?: boolean;
}

export function WhiteLabelPreview({ name, logoUrl, primaryColor, isWhiteLabel = false }: Props) {
  return (
    <div className="bg-bg rounded-2xl p-4 border border-gray-700">
      <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Предпросмотр</p>

      {/* Simulated navbar */}
      <div className="bg-bg border-b border-border px-4 py-3 flex items-center justify-between rounded-t-xl mb-3">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={name}
              width={28}
              height={28}
              unoptimized
              className="w-7 h-7 rounded-lg object-cover"
            />
          ) : isWhiteLabel ? (
            <span className="text-lg font-bold" style={{ color: primaryColor }}>◈</span>
          ) : (
            <VizoraMark className="h-7 w-7" />
          )}
          <span className="text-primary font-bold text-sm">{name || "Vizora AI"}</span>
        </div>
        <span className="text-xs text-secondary">Выйти</span>
      </div>

      {/* Simulated progress bar */}
      <div className="px-2 mb-3">
        <div className="flex justify-between text-xs text-secondary mb-1.5">
          <span>Прогресс подготовки</span>
          <span style={{ color: primaryColor }}>45%</span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
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
      <p className="text-[10px] text-secondary/40 text-right mt-2">Powered by Vizora AI</p>
    </div>
  );
}
