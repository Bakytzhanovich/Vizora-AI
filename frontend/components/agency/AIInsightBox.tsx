import { Sparkles } from "lucide-react";

interface Props {
  insight: string;
  recommendation: string;
}

export function AIInsightBox({ insight, recommendation }: Props) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="text-sm font-bold text-blue-900">AI Рекомендация</span>
      </div>
      <p className="text-sm text-gray-700 mb-3 leading-relaxed">{insight}</p>
      <div className="bg-white/70 rounded-xl px-4 py-3 border border-blue-100">
        <p className="text-xs font-semibold text-blue-700 mb-0.5">Что делать:</p>
        <p className="text-sm text-gray-700">{recommendation}</p>
      </div>
    </div>
  );
}
