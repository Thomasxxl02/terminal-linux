import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Info, CheckCircle2, X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "danger" | "warning" | "info" | "success";
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
  onCancel,
  type = "danger",
}: ConfirmationModalProps) {
  const iconMap = {
    danger: <AlertTriangle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    info: <Info className="w-5 h-5 text-sky-400" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
  };

  const borderColors = {
    danger: "border-red-500/20 hover:bg-red-500/10",
    warning: "border-amber-500/20 hover:bg-amber-500/10",
    info: "border-sky-500/20 hover:bg-sky-500/10",
    success: "border-emerald-500/20 hover:bg-emerald-500/10",
  };

  const buttonColors = {
    danger: "bg-red-600 hover:bg-red-500 text-white",
    warning: "bg-amber-600 hover:bg-amber-500 text-slate-950",
    info: "bg-sky-600 hover:bg-sky-500 text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 text-slate-950",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" id="confirmation-modal-overlay">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 overflow-hidden"
            id="confirmation-modal-card"
          >
            {/* Header / Title */}
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-lg bg-slate-800/80 border ${borderColors[type]}`}>
                {iconMap[type]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-100 tracking-wide font-mono mb-1">
                  {title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  {message}
                </p>
              </div>
              <button
                onClick={onCancel}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-mono font-bold rounded-lg transition-colors border border-slate-700/50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-xs font-mono font-bold rounded-lg shadow-md transition-all ${buttonColors[type]}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
