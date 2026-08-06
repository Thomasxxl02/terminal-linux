import React from "react";

export interface EditorSettings {
  fontSize: number;
  wordWrap: "on" | "off";
  minimap: boolean;
  theme: string;
  tabSize: number;
  autoSave: boolean;
}

interface MonacoSettingsPanelProps {
  settings: EditorSettings;
  onUpdateSetting: <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => void;
}

/**
 * Panneau de réglages de l'éditeur Monaco (extrait de MonacoFileEditor).
 * Composant purement présentatif : settings + callback de mise à jour.
 */
export const MonacoSettingsPanel: React.FC<MonacoSettingsPanelProps> = ({
  settings,
  onUpdateSetting,
}) => {
  return (
    <div className="bg-[#0b0f19] border-b border-slate-800 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 z-20 text-xs font-mono">
      <div className="space-y-1">
        <span className="text-slate-400 text-[10px] uppercase">Police</span>
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1">
          <input
            type="number"
            value={settings.fontSize}
            onChange={(e) => onUpdateSetting("fontSize", Math.max(10, Math.min(24, parseInt(e.target.value) || 12)))}
            className="bg-transparent text-slate-200 w-full focus:outline-none"
          />
          <span className="text-[10px] text-slate-500">px</span>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-slate-400 text-[10px] uppercase">Retour à la ligne</span>
        <select
          value={settings.wordWrap}
          onChange={(e) => onUpdateSetting("wordWrap", e.target.value as "on" | "off")}
          className="bg-slate-950 text-slate-300 border border-slate-800 rounded px-2 py-1 w-full"
        >
          <option value="on">Activé</option>
          <option value="off">Désactivé</option>
        </select>
      </div>

      <div className="space-y-1">
        <span className="text-slate-400 text-[10px] uppercase">Minimap</span>
        <select
          value={settings.minimap ? "true" : "false"}
          onChange={(e) => onUpdateSetting("minimap", e.target.value === "true")}
          className="bg-slate-950 text-slate-300 border border-slate-800 rounded px-2 py-1 w-full"
        >
          <option value="true">Visible</option>
          <option value="false">Masqué</option>
        </select>
      </div>

      <div className="space-y-1">
        <span className="text-slate-400 text-[10px] uppercase">Sauvegarde Auto</span>
        <select
          value={settings.autoSave ? "true" : "false"}
          onChange={(e) => onUpdateSetting("autoSave", e.target.value === "true")}
          className="bg-slate-950 text-slate-300 border border-slate-800 rounded px-2 py-1 w-full"
        >
          <option value="true">Actif (1.5s)</option>
          <option value="false">Inactif</option>
        </select>
      </div>
    </div>
  );
};
