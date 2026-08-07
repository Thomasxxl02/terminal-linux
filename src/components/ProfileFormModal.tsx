import React from "react";
import { Sliders, Plus, Trash2 } from "lucide-react";
import { ShellProfile } from "../types";

interface ProfileFormModalProps {
  editingProfile: ShellProfile | null;
  formName: string;
  setFormName: (v: string) => void;
  formShell: string;
  setFormShell: (v: string) => void;
  formCwd: string;
  setFormCwd: (v: string) => void;
  formColor: string;
  setFormColor: (v: string) => void;
  formStartupScript: string;
  setFormStartupScript: (v: string) => void;
  envPairs: { key: string; value: string }[];
  setEnvPairs: (v: { key: string; value: string }[]) => void;
  handleSaveProfile: (e: React.FormEvent) => void;
  onClose: () => void;
}

/** Modal de création/édition d'un profil shell (nom, exécutable, CWD,
 *  couleur, script de démarrage, variables d'environnement). */
export function ProfileFormModal({
  editingProfile,
  formName,
  setFormName,
  formShell,
  setFormShell,
  formCwd,
  setFormCwd,
  formColor,
  setFormColor,
  formStartupScript,
  setFormStartupScript,
  envPairs,
  setEnvPairs,
  handleSaveProfile,
  onClose,
}: ProfileFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        <h3 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          {editingProfile ? "Éditer le Profil Shell" : "Créer un Nouveau Profil Shell"}
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4 font-mono text-xs overflow-y-auto pr-1 custom-scrollbar">
          <div>
            <label className="block text-slate-400 mb-1">Nom du Profil</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex: Python Data Science"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Exécutable Shell</label>
              <select
                value={formShell}
                onChange={(e) => setFormShell(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="/bin/bash">/bin/bash</option>
                <option value="/bin/zsh">/bin/zsh</option>
                <option value="fish">fish</option>
                <option value="/bin/sh">/bin/sh</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Couleur d'accent</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-10 h-9 bg-slate-950 border border-slate-800 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Répertoire de travail initial (CWD)</label>
            <input
              type="text"
              value={formCwd}
              onChange={(e) => setFormCwd(e.target.value)}
              placeholder="Ex: /var/log ou /tmp"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Startup script trigger commands */}
          <div>
            <label className="block text-slate-400 mb-1">
              Script/Commandes à injecter au démarrage (Startup Script)
            </label>
            <textarea
              value={formStartupScript}
              onChange={(e) => setFormStartupScript(e.target.value)}
              placeholder="Ex: echo 'Term initialisé' && alias ll='ls -lh' && nvm use 18"
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
            />
          </div>

          {/* Dynamic Key-Value Environment Variables */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400">Variables d'Environnement (Key=Value)</label>
              <button
                type="button"
                onClick={() => setEnvPairs([...envPairs, { key: "", value: "" }])}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Ajouter Var
              </button>
            </div>

            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar p-1 bg-slate-950 rounded border border-slate-800">
              {envPairs.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="KEY"
                    value={pair.key}
                    onChange={(e) => {
                      const updated = [...envPairs];
                      updated[idx].key = e.target.value;
                      setEnvPairs(updated);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 focus:outline-none"
                  />
                  <span className="text-slate-500">=</span>
                  <input
                    type="text"
                    placeholder="VALUE"
                    value={pair.value}
                    onChange={(e) => {
                      const updated = [...envPairs];
                      updated[idx].value = e.target.value;
                      setEnvPairs(updated);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setEnvPairs(envPairs.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg shadow"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
