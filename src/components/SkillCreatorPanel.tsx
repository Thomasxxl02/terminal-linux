import { Code, AlertCircle, Save, Trash2 } from "lucide-react";

// Type identique à celui déclaré dans SkillsHub (cohérence stricte)
interface SkillParameter {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  defaultValue: string;
  options?: string[];
}

interface SkillCreatorPanelProps {
  newTitle: string;
  setNewTitle: (v: string) => void;
  newCategory: string;
  setNewCategory: (v: string) => void;
  newDescription: string;
  setNewDescription: (v: string) => void;
  newScriptTemplate: string;
  setNewScriptTemplate: (v: string) => void;
  newParams: SkillParameter[];
  tempParamName: string;
  setTempParamName: (v: string) => void;
  tempParamLabel: string;
  setTempParamLabel: (v: string) => void;
  tempParamType: "text" | "number" | "select" | "checkbox";
  setTempParamType: (v: "text" | "number" | "select" | "checkbox") => void;
  tempParamDefault: string;
  setTempParamDefault: (v: string) => void;
  tempParamOptions: string;
  setTempParamOptions: (v: string) => void;
  handleAddParameter: () => void;
  handleRemoveNewParam: (idx: number) => void;
  handleSaveCustomSkill: () => void;
  unmappedVars: string[];
}

/** Interface de création d'une compétence personnalisée (formulaire
 *  principal + définition des variables de formulaire). */
export function SkillCreatorPanel({
  newTitle,
  setNewTitle,
  newCategory,
  setNewCategory,
  newDescription,
  setNewDescription,
  newScriptTemplate,
  setNewScriptTemplate,
  newParams,
  tempParamName,
  setTempParamName,
  tempParamLabel,
  setTempParamLabel,
  tempParamType,
  setTempParamType,
  tempParamDefault,
  setTempParamDefault,
  tempParamOptions,
  setTempParamOptions,
  handleAddParameter,
  handleRemoveNewParam,
  handleSaveCustomSkill,
  unmappedVars,
}: SkillCreatorPanelProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Code className="w-5 h-5 text-indigo-400" />
        <h3 className="text-base font-bold text-slate-100">Créateur de Compétence Personnalisée</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* Left Col: Metadata & Script */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300">Titre de la compétence</label>
              <input
                type="text"
                placeholder="e.g., Déployeur Git Express"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300">Catégorie</label>
              <input
                type="text"
                placeholder="e.g., Git, DevOps, Nettoyage"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-300">Description</label>
            <textarea
              placeholder="Expliquez ce que réalise ce script d'automatisation..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-bold text-slate-300">Modèle de Script Bash/Shell</label>
              <span className="text-[10px] text-slate-500 font-medium">Utilisez <code className="text-indigo-400 font-mono">{"{{nom_variable}}"}</code> pour les paramètres</span>
            </div>
            <textarea
              placeholder="git checkout {{branch}} && git pull origin {{branch}} && npm run build"
              value={newScriptTemplate}
              onChange={(e) => setNewScriptTemplate(e.target.value)}
              rows={4}
              className="w-full bg-slate-950 font-mono text-[11px] text-emerald-400 border border-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 resize-y"
            />

            {/* Validation Warnings */}
            {unmappedVars.length > 0 && (
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/25 rounded-lg text-yellow-500 text-[10px] flex items-center gap-2 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Attention : Les variables suivantes sont utilisées dans le script mais non définies ci-contre : <strong className="font-mono">{unmappedVars.map(v => `{{${v}}}`).join(", ")}</strong></span>
              </div>
            )}
          </div>

          <button
            onClick={handleSaveCustomSkill}
            disabled={!newTitle.trim() || !newScriptTemplate.trim()}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-100 font-bold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Enregistrer & Publier la Compétence
          </button>
        </div>

        {/* Right Col: Parameters Definition */}
        <div className="bg-slate-950/40 p-5 border border-slate-800/80 rounded-xl space-y-4">
          <span className="font-bold text-slate-300 tracking-wider block">DÉFINITION DES VARIABLES DE FORMULAIRE</span>

          {/* Form to add a new parameter */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg space-y-3">
            <span className="text-[10px] uppercase font-bold text-indigo-400 block">Nouveau Paramètre</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">ID Variable (dans le script)</label>
                <input
                  type="text"
                  placeholder="e.g., branch"
                  value={tempParamName}
                  onChange={(e) => setTempParamName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Label d'affichage</label>
                <input
                  type="text"
                  placeholder="e.g., Branche Git"
                  value={tempParamLabel}
                  onChange={(e) => setTempParamLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Type de champ</label>
                <select
                  value={tempParamType}
                  onChange={(e) => setTempParamType(e.target.value as "text" | "number" | "select" | "checkbox")}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500 text-slate-300"
                >
                  <option value="text">Texte (Input)</option>
                  <option value="number">Nombre (Input)</option>
                  <option value="select">Liste (Select)</option>
                  <option value="checkbox">Boîte à cocher (Boolean)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Valeur par défaut</label>
                <input
                  type="text"
                  placeholder="e.g., main"
                  value={tempParamDefault}
                  onChange={(e) => setTempParamDefault(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {tempParamType === "select" && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Options de liste (séparées par une virgule)</label>
                <input
                  type="text"
                  placeholder="main, dev, staging, master"
                  value={tempParamOptions}
                  onChange={(e) => setTempParamOptions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <button
              onClick={handleAddParameter}
              className="w-full py-1.5 bg-slate-850 hover:bg-slate-800 text-indigo-300 font-bold rounded border border-indigo-500/20 text-xs transition-all"
            >
              Ajouter cette variable au formulaire
            </button>
          </div>

          {/* Dynamic list of current variables added */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Variables de formulaire enregistrées ({newParams.length})</span>
            {newParams.length === 0 ? (
              <div className="text-center p-4 bg-slate-900/40 border border-slate-850 rounded-lg text-slate-500 text-[11px]">
                Aucune variable définie. Le script s'exécutera tel quel de manière statique.
              </div>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                {newParams.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-300 flex items-center gap-2">
                        {p.label}
                        <code className="text-[10px] text-indigo-400 font-mono">{"{{" + p.name + "}}"}</code>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Type : {p.type} | Défaut : <span className="font-mono text-slate-400">{p.defaultValue || "aucun"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveNewParam(idx)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
