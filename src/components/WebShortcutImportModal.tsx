import React from "react";
import { Upload } from "lucide-react";

interface WebShortcutImportModalProps {
  importJsonText: string;
  setImportJsonText: (v: string) => void;
  handleImportJson: (e: React.FormEvent) => void;
  onClose: () => void;
}

/** Modal d'import JSON des raccourcis web (remplace la liste actuelle). */
export function WebShortcutImportModal({
  importJsonText,
  setImportJsonText,
  handleImportJson,
  onClose,
}: WebShortcutImportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-5">
        <h3 className="text-sm font-bold text-slate-100 mb-2 font-mono flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-400" />
          Importer des Raccourcis (Format JSON)
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Collez un tableau JSON de raccourcis web pour remplacer votre liste actuelle.
        </p>
        <form onSubmit={handleImportJson} className="space-y-4">
          <textarea
            rows={8}
            required
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder='[ { "id": "sc-1", "title": "GitHub", "url": "https://github.com", "category": "Dev" } ]'
            className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs font-mono rounded-lg focus:outline-none focus:border-emerald-500"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-mono font-bold rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-mono font-bold rounded-lg"
            >
              Valider l'import
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
