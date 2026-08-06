import React, { useState } from "react";
import { Globe, X } from "lucide-react";
import { WebShortcut } from "../types";

interface WebShortcutFormModalProps {
  editingShortcut: WebShortcut | null;
  onSave: (data: {
    title: string;
    url: string;
    description: string;
    category: string;
    color: string;
    tags: string[];
    openMode: "new_tab" | "embedded" | "curl_terminal";
  }) => void;
  onClose: () => void;
}

const COLOR_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
};

/**
 * Formulaire de création/édition d'un raccourci web (extrait de
 * WebShortcutsManager). États du formulaire locaux ; le parent gère
 * la liste et la persistance.
 */
export const WebShortcutFormModal: React.FC<WebShortcutFormModalProps> = ({
  editingShortcut,
  onSave,
  onClose,
}) => {
  const [formTitle, setFormTitle] = useState(editingShortcut?.title || "");
  const [formUrl, setFormUrl] = useState(editingShortcut?.url || "https://");
  const [formDescription, setFormDescription] = useState(editingShortcut?.description || "");
  const [formCategory, setFormCategory] = useState(editingShortcut?.category || "Dev");
  const [formColor, setFormColor] = useState(editingShortcut?.color || "sky");
  const [formTags, setFormTags] = useState((editingShortcut?.tags || []).join(", "));
  const [formOpenMode, setFormOpenMode] = useState<"new_tab" | "embedded" | "curl_terminal">(
    editingShortcut?.openMode || "new_tab"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formUrl.trim()) return;

    let formattedUrl = formUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const tagList = formTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    onSave({
      title: formTitle.trim(),
      url: formattedUrl,
      description: formDescription.trim(),
      category: formCategory.trim() || "Dev",
      color: formColor,
      tags: tagList,
      openMode: formOpenMode,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden font-sans">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
            <Globe className="w-4 h-4 text-emerald-400" />
            {editingShortcut ? "Modifier le Raccourci Web" : "Nouveau Raccourci Web"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
              Titre du Raccourci *
            </label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="ex: Portainer, GitHub, Grafana..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
              Adresse URL *
            </label>
            <input
              type="text"
              required
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://github.com ou http://localhost:8080"
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
              Description
            </label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Brève description de l'application ou du service..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                Catégorie
              </label>
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="Dev, Monitoring, Docs..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                Mode d'ouverture
              </label>
              <select
                value={formOpenMode}
                onChange={(e) => setFormOpenMode(e.target.value as "new_tab" | "embedded" | "curl_terminal")}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="new_tab">Nouvel onglet</option>
                <option value="embedded">Aperçu Intégré (Iframe)</option>
                <option value="curl_terminal">Exécuter cURL au Terminal</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
              Tags (séparés par des virgules)
            </label>
            <input
              type="text"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="docker, metrics, rust, api"
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
              Couleur Thématique
            </label>
            <div className="flex items-center gap-2">
              {Object.keys(COLOR_CLASSES).map((clr) => (
                <button
                  key={clr}
                  type="button"
                  onClick={() => setFormColor(clr)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    formColor === clr ? "scale-110 border-white" : "border-transparent"
                  }`}
                  style={{
                    backgroundColor:
                      clr === "emerald"
                        ? "#10b981"
                        : clr === "sky"
                        ? "#0ea5e9"
                        : clr === "purple"
                        ? "#a855f7"
                        : clr === "amber"
                        ? "#f59e0b"
                        : clr === "rose"
                        ? "#f43f5e"
                        : clr === "blue"
                        ? "#3b82f6"
                        : "#6366f1",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-mono font-bold rounded-lg transition-colors shadow-md"
            >
              {editingShortcut ? "Enregistrer" : "Créer le Raccourci"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
