import { Globe, ExternalLink, RefreshCw, X } from "lucide-react";
import { WebShortcut } from "../types";

interface WebShortcutPreviewModalProps {
  shortcut: WebShortcut;
  onClose: () => void;
  onRefresh: () => void;
}

/** Aperçu plein écran d'un raccourci web (iframe sandboxée). */
export function WebShortcutPreviewModal({
  shortcut,
  onClose,
  onRefresh,
}: WebShortcutPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 font-sans">
      {/* Top Address Bar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200">{shortcut.title}</span>
        </div>

        <div className="flex-1 max-w-xl mx-auto bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="truncate">{shortcut.url}</span>
          <a
            href={shortcut.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300 ml-2"
            title="Ouvrir dans un onglet externe"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg"
            title="Fermer l'aperçu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Iframe Frame */}
      <div className="flex-1 w-full bg-white relative">
        <iframe
          src={shortcut.url}
          title={shortcut.title}
          className="w-full h-full border-none"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
