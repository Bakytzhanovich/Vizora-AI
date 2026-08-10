"use client";

import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bottom-sheet-style confirmation shown before logging out — slides up from
 * the bottom on mobile widths (native app pattern) and centers as a card on
 * wider screens, instead of the jarring native browser confirm(). */
export function LogoutConfirmModal({ onConfirm, onCancel }: Props) {
  const { t } = useTranslation("common");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-sm bg-[#13131A] border border-[#1E1E2E] rounded-t-3xl sm:rounded-3xl px-6 pt-3 pb-6"
        >
          {/* Drag-handle affordance — mobile bottom-sheet only */}
          <div className="w-9 h-1 bg-[#2A2A3A] rounded-full mx-auto mb-5 sm:hidden" />

          <div className="w-14 h-14 rounded-full bg-[#FF6B6B]/12 flex items-center justify-center mx-auto mb-4">
            <LogOut size={24} className="text-[#FF6B6B]" />
          </div>

          <h2 className="text-[#F0F0FF] text-lg font-bold text-center mb-1.5">
            {t("nav.logout_confirm_title")}
          </h2>
          <p className="text-[#8B8BA7] text-sm text-center mb-6 leading-relaxed">
            {t("nav.logout_confirm")}
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={onConfirm}
              className="w-full bg-[#FF6B6B] text-white font-semibold py-3.5 rounded-xl text-sm transition-transform active:scale-[0.98]"
            >
              {t("nav.logout")}
            </button>
            <button
              onClick={onCancel}
              className="w-full bg-[#1E1E2E] text-[#8B8BA7] hover:text-[#F0F0FF] font-medium py-3.5 rounded-xl text-sm transition-colors active:scale-[0.98]"
            >
              {t("common.cancel")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
