import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Play,
  Copy,
  Check,
  Plus,
  Trash2,
  Globe,
  FileSearch,
  Activity,
  Box as BoxIcon,
  Code,
  Sliders,
  Info,
  Search,
  AlertCircle,
  Download,
  Flame,
  CheckCircle2,
  Clock
} from "lucide-react";
import { useSecureStorage } from "../hooks/useSecureStorage";
import { SkillCreatorPanel } from "./SkillCreatorPanel";

interface SkillParameter {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox";
  defaultValue: string;
  options?: string[]; // for select type
  placeholder?: string;
}

interface CustomSkill {
  id: string;
  title: string;
  description: string;
  category: string;
  scriptTemplate: string;
  parameters: SkillParameter[];
  isCustom: boolean;
}

interface SkillsHubProps {
  onExecuteInTerminal: (command: string) => void;
}

// Initial/Predefined complex skills
const PREDEFINED_SKILLS: CustomSkill[] = [
  {
    id: "net-scan",
    title: "Scanner de Ports Réseau",
    description: "Vérifie les ports ouverts sur une machine distante ou locale à l'aide d'outils réseau POSIX.",
    category: "Réseau",
    scriptTemplate: "echo '=== Lancement du scan de ports sur {{host}} ===' && (nc -zv -w 2 {{host}} {{ports}} 2>&1 || ss -tulpn | grep -E '{{ports}}' || echo 'Outil nc non disponible, vérification locale via ss.')",
    isCustom: false,
    parameters: [
      { name: "host", label: "Hôte ou IP Cible", type: "text", defaultValue: "127.0.0.1", placeholder: "e.g., localhost, 8.8.8.8" },
      { name: "ports", label: "Ports à scanner", type: "text", defaultValue: "22 80 443 3000", placeholder: "e.g., 22 80 443" }
    ]
  },
  {
    id: "log-analyzer",
    title: "Analyseur de Logs Avancé",
    description: "Recherche et filtre des motifs d'erreur spécifiques dans les journaux système Linux en temps réel.",
    category: "Diagnostic",
    scriptTemplate: "echo '=== Recherche de \"{{keyword}}\" dans {{filepath}} ===' && tail -n {{lines}} {{filepath}} | grep -i --color=always '{{keyword}}'",
    isCustom: false,
    parameters: [
      { name: "filepath", label: "Chemin du fichier Log", type: "text", defaultValue: "/var/log/syslog", placeholder: "e.g., /var/log/nginx/access.log" },
      { name: "keyword", label: "Mot-clé / Regex", type: "text", defaultValue: "error", placeholder: "e.g., error, fatal, 404" },
      { name: "lines", label: "Nombre de lignes à analyser", type: "number", defaultValue: "100", placeholder: "e.g., 50" }
    ]
  },
  {
    id: "stress-test",
    title: "Générateur de Charge CPU / IO",
    description: "Simule une charge de travail artificielle sur les cœurs du CPU pour valider l'agilité thermique et l'ordonnanceur.",
    category: "Performance",
    scriptTemplate: "echo '=== Lancement de la charge CPU ({{cores}} coeurs pendant {{duration}} secondes) ===' && (timeout {{duration}} md5sum /dev/zero & jobs -p | xargs kill 2>/dev/null || for i in $(seq 1 {{cores}}); do yes > /dev/null & done && sleep {{duration}} && killall yes || echo 'Stress complété.')",
    isCustom: false,
    parameters: [
      { name: "cores", label: "Nombre de Cœurs", type: "select", defaultValue: "1", options: ["1", "2", "4", "8"] },
      { name: "duration", label: "Durée (secondes)", type: "number", defaultValue: "15", placeholder: "e.g., 10" }
    ]
  },
  {
    id: "docker-manager",
    title: "Nettoyeur de Conteneurs Docker",
    description: "Analyse l'espace disque consommé par Docker et exécute un nettoyage sécurisé des images/volumes orphelins.",
    category: "Conteneurisation",
    scriptTemplate: "echo '=== Espace Disque Docker Actuel ===' && docker system df && if [ '{{prune}}' = 'true' ]; then echo '=== Nettoyage en cours ===' && docker system prune -a --volumes -f; else echo 'Nettoyage ignoré.'; fi",
    isCustom: false,
    parameters: [
      { name: "prune", label: "Exécuter l'élagage complet (prune -a)", type: "checkbox", defaultValue: "false" }
    ]
  }
];

export const SkillsHub: React.FC<SkillsHubProps> = ({ onExecuteInTerminal }) => {
  // Skills personnalisés = scripts exécutables (peuvent contenir des secrets)
  // → stockage sécurisé (keyring OS en Tauri, localStorage clair en web)
  const { value: customSkills, setValue: setCustomSkills } = useSecureStorage<CustomSkill[]>(
    "terminal_custom_skills",
    []
  );
  const [skills, setSkills] = useState<CustomSkill[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string>("net-scan");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedScript, setCopiedScript] = useState(false);

  // --- Skill Builder Creator Form State ---
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("Automatisation");
  const [newScriptTemplate, setNewScriptTemplate] = useState("");
  const [newParams, setNewParams] = useState<SkillParameter[]>([]);

  // Input fields for current new param being added
  const [tempParamName, setTempParamName] = useState("");
  const [tempParamLabel, setTempParamLabel] = useState("");
  const [tempParamType, setTempParamType] = useState<"text" | "number" | "select" | "checkbox">("text");
  const [tempParamDefault, setTempParamDefault] = useState("");
  const [tempParamOptions, setTempParamOptions] = useState("");

  // Share and Import configs state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareJsonString, setShareJsonString] = useState("");
  const [importFeedback, setImportFeedback] = useState("");

  // Local Session Telemetry
  const [totalExecutions, setTotalExecutions] = useState(0);
  const [recentRuns, setRecentRuns] = useState<{ id: string; name: string; timestamp: string; script: string }[]>([]);

  // Load predefined and custom skills (depuis le stockage sécurisé)
  useEffect(() => {
    setSkills([...PREDEFINED_SKILLS, ...(customSkills ?? [])]);
  }, [customSkills]);

  const activeSkill = skills.find((s) => s.id === activeSkillId) || skills[0] || PREDEFINED_SKILLS[0];

  // Initialize form parameter values when active skill changes
  useEffect(() => {
    if (activeSkill) {
      const initialVals: Record<string, string> = {};
      activeSkill.parameters.forEach((p) => {
        initialVals[p.name] = p.defaultValue;
      });
      setParamValues(initialVals);
    }
  }, [activeSkillId, skills]);

  const handleParamChange = (name: string, value: string) => {
    setParamValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Compile / Resolve template command with input values
  const getResolvedCommand = (): string => {
    if (!activeSkill) return "";
    let cmd = activeSkill.scriptTemplate;
    activeSkill.parameters.forEach((p) => {
      const val = paramValues[p.name] !== undefined ? paramValues[p.name] : p.defaultValue;
      cmd = cmd.replace(new RegExp(`{{${p.name}}}`, "g"), val);
    });
    return cmd;
  };

  const handleExecute = () => {
    const cmd = getResolvedCommand();
    if (cmd) {
      onExecuteInTerminal(cmd);
      setTotalExecutions(prev => prev + 1);

      // Append to local audit log
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setRecentRuns(prev => [
        { id: Date.now().toString(), name: activeSkill.title, timestamp: timeStr, script: cmd },
        ...prev.slice(0, 4)
      ]);
    }
  };

  const handleCopyCommand = async () => {
    const cmd = getResolvedCommand();
    if (cmd) {
      await navigator.clipboard.writeText(cmd);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  // --- Custom Skill Creation Handlers ---
  const handleAddParameter = () => {
    if (!tempParamName.trim() || !tempParamLabel.trim()) return;

    const newParam: SkillParameter = {
      name: tempParamName.trim().toLowerCase().replace(/[^a-z0-9]/g, ""),
      label: tempParamLabel,
      type: tempParamType,
      defaultValue: tempParamDefault,
    };

    if (tempParamType === "select" && tempParamOptions.trim()) {
      newParam.options = tempParamOptions.split(",").map((o) => o.trim());
    }

    setNewParams((prev) => [...prev, newParam]);
    
    // Reset temp inputs
    setTempParamName("");
    setTempParamLabel("");
    setTempParamType("text");
    setTempParamDefault("");
    setTempParamOptions("");
  };

  const handleRemoveNewParam = (idx: number) => {
    setNewParams((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveCustomSkill = () => {
    if (!newTitle.trim() || !newScriptTemplate.trim()) return;

    const generatedId = "custom-" + Date.now();
    const newSkill: CustomSkill = {
      id: generatedId,
      title: newTitle,
      description: newDescription || "Compétence personnalisée d'automatisation shell.",
      category: newCategory,
      scriptTemplate: newScriptTemplate,
      parameters: newParams,
      isCustom: true
    };

    const currentCustoms = customSkills ?? [];
    const updatedCustoms = [...currentCustoms, newSkill];
    setCustomSkills(updatedCustoms);

    setSkills([...PREDEFINED_SKILLS, ...updatedCustoms]);
    setActiveSkillId(generatedId);
    setIsCreating(false);

    // Reset creator inputs
    setNewTitle("");
    setNewDescription("");
    setNewCategory("Automatisation");
    setNewScriptTemplate("");
    setNewParams([]);
  };

  const handleDeleteCustomSkill = (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const currentCustoms = customSkills ?? [];
    const filtered = currentCustoms.filter((s) => s.id !== id);
    setCustomSkills(filtered);
    setSkills([...PREDEFINED_SKILLS, ...filtered]);
    if (activeSkillId === id) {
      setActiveSkillId("net-scan");
    }
  };

  // --- Export / Import Config center handlers ---
  const handleOpenExport = () => {
    const saved = JSON.stringify(customSkills ?? []);
    setShareJsonString(saved);
    setShowShareModal(true);
    setImportFeedback("");
  };

  const handleImportConfig = () => {
    try {
      const parsed = JSON.parse(shareJsonString);
      if (!Array.isArray(parsed)) {
        setImportFeedback("Format invalide : Doit être un tableau de compétences.");
        return;
      }
      
      // Ensure properties exist
      const checked: CustomSkill[] = parsed.map((item: unknown) => {
        const it = item as Record<string, unknown>;
        return {
          id: (it.id as string) || "custom-" + Math.random().toString(36).substr(2, 9),
          title: (it.title as string) || "Skill Importé",
          description: (it.description as string) || "Aucune description.",
          category: (it.category as string) || "Importé",
          scriptTemplate: (it.scriptTemplate as string) || "",
          parameters: Array.isArray(it.parameters)
            ? (it.parameters as Record<string, unknown>[]).map((p) => ({
                name: (p.name as string) || "param",
                label: (p.label as string) || (p.name as string) || "Paramètre",
                type: (["text", "number", "select", "checkbox"].includes(p.type as string) ? p.type : "text") as SkillParameter["type"],
                defaultValue: (p.defaultValue as string) || "",
                options: Array.isArray(p.options) ? (p.options as string[]) : undefined,
                placeholder: p.placeholder as string | undefined,
              }))
            : [],
          isCustom: true
        };
      });

      setCustomSkills(checked);
      setSkills([...PREDEFINED_SKILLS, ...checked]);
      setImportFeedback("✓ Importation réussie !");
      setTimeout(() => setShowShareModal(false), 1500);
    } catch (err) {
      setImportFeedback("Erreur d'analyse JSON. Vérifiez la syntaxe.");
    }
  };

  // --- Parse Script Template for parameter references for live warnings ---
  const getTemplateVariables = (tpl: string): string[] => {
    const matches = tpl.match(/{{([a-zA-Z0-9_]+)}}/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/[{}]/g, ""));
  };

  const templateVars = getTemplateVariables(newScriptTemplate);
  const definedVarNames = newParams.map(p => p.name);
  const unmappedVars = templateVars.filter(v => !definedVarNames.includes(v));

  const filteredSkills = useMemo(
    () =>
      skills.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [skills, searchQuery]
  );

  return (
    <div className="flex-1 bg-slate-950 text-slate-200 p-6 overflow-y-auto custom-scrollbar space-y-6 select-none">
      
      {/* Page Header */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl shadow-inner shrink-0">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 flex-wrap">
              Super-Compétences & Fonctions d'Automatisation
              <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                Skills Engine
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Exécutez des macros intelligentes, des utilitaires de diagnostic et des fonctions paramétrées directement sur vos terminaux PTY ou serveurs SSH distants.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-center">
          <button
            onClick={handleOpenExport}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg transition-all"
            title="Importer / Exporter les Compétences"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 border border-indigo-500/40 font-semibold text-xs rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-950/20 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {isCreating ? "Fermer le Créateur" : "Créer une Compétence"}
          </button>
        </div>
      </div>

      {/* Share / Config Backup Modal popup */}
      {showShareModal && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <Download className="w-4 h-4" /> Importateur & Exportateur de Compétences
            </h4>
            <button onClick={() => setShowShareModal(false)} className="text-[10px] text-slate-500 hover:text-slate-300">Fermer</button>
          </div>
          
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 block">JSON de configuration des compétences personnalisées :</label>
            <textarea
              value={shareJsonString}
              onChange={(e) => setShareJsonString(e.target.value)}
              rows={4}
              placeholder="Collez ici votre JSON partagé de compétences..."
              className="w-full bg-slate-950 font-mono text-[10px] text-emerald-400 border border-slate-850 p-2.5 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] text-slate-500 font-mono">{importFeedback || "Copiez le JSON pour exporter, modifiez-le pour importer."}</span>
            <div className="flex gap-2">
              <button
                onClick={handleImportConfig}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 text-xs font-bold rounded"
              >
                Importer
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreating ? (
        <SkillCreatorPanel
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          newDescription={newDescription}
          setNewDescription={setNewDescription}
          newScriptTemplate={newScriptTemplate}
          setNewScriptTemplate={setNewScriptTemplate}
          newParams={newParams}
          tempParamName={tempParamName}
          setTempParamName={setTempParamName}
          tempParamLabel={tempParamLabel}
          setTempParamLabel={setTempParamLabel}
          tempParamType={tempParamType}
          setTempParamType={setTempParamType}
          tempParamDefault={tempParamDefault}
          setTempParamDefault={setTempParamDefault}
          tempParamOptions={tempParamOptions}
          setTempParamOptions={setTempParamOptions}
          handleAddParameter={handleAddParameter}
          handleRemoveNewParam={handleRemoveNewParam}
          handleSaveCustomSkill={handleSaveCustomSkill}
          unmappedVars={unmappedVars}
        />
      ) : (
        /* --- Standard Interactive Skills Workspace --- */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Left panel: Skills Selector & Search */}
          <div className="xl:col-span-1 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Filtrer les compétences..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5 max-h-[480px] overflow-y-auto custom-scrollbar">
              <span className="text-[10px] uppercase font-bold text-slate-500 px-2 tracking-widest block mb-1">
                BIBLIOTHÈQUE DE COMPÉTENCES
              </span>

              {filteredSkills.map((s) => {
                const isActive = activeSkillId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSkillId(s.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 relative group ${
                      isActive
                        ? "bg-slate-950 border-indigo-500/50 text-slate-100 shadow-md"
                        : "bg-transparent border-transparent hover:bg-slate-950/40 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className={`p-2 rounded-md ${isActive ? "bg-indigo-500/10 text-indigo-400" : "bg-slate-800 text-slate-500"}`}>
                      {s.id === "net-scan" && <Globe className="w-4 h-4" />}
                      {s.id === "log-analyzer" && <FileSearch className="w-4 h-4" />}
                      {s.id === "stress-test" && <Activity className="w-4 h-4" />}
                      {s.id === "docker-manager" && <BoxIcon className="w-4 h-4" />}
                      {s.isCustom && <Code className="w-4 h-4" />}
                    </div>

                    <div className="space-y-1 truncate flex-1 pr-6">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs truncate leading-tight">{s.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{s.description}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-800/60 font-medium font-semibold uppercase">
                          {s.category}
                        </span>
                        {s.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase">
                            Custom
                          </span>
                        )}
                      </div>
                    </div>

                    {s.isCustom && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomSkill(s.id, e);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            handleDeleteCustomSkill(s.id, e);
                          }
                        }}
                        className="absolute right-3 top-3 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Supprimer la compétence"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}

              {filteredSkills.length === 0 && (
                <div className="text-center p-6 text-slate-500 text-xs">
                  Aucune compétence ne correspond à votre recherche.
                </div>
              )}
            </div>

            {/* Quick Session Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block border-b border-slate-850 pb-1.5">Performances Session</span>
              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="bg-slate-950 p-2 border border-slate-850 rounded-lg">
                  <span className="text-[10px] text-slate-500 block uppercase">Lancements</span>
                  <span className="font-mono text-base font-bold text-indigo-400 flex items-center justify-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> {totalExecutions}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 border border-slate-850 rounded-lg">
                  <span className="text-[10px] text-slate-500 block uppercase">Customs</span>
                  <span className="font-mono text-base font-bold text-indigo-400">
                    {skills.filter(s => s.isCustom).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right workspace: Selected Skill details & interactive execution panel */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
              
              {/* Header inside Workspace */}
              <div className="flex justify-between items-start gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1.5 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-850 text-indigo-400 border border-indigo-500/15 font-bold font-semibold">
                    {activeSkill.category}
                  </span>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 truncate">
                    {activeSkill.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {activeSkill.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyCommand}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-lg transition-all"
                    title="Copier le script résolu"
                  >
                    {copiedScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Dynamic parameters inputs */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Arguments de la fonction</span>
                </div>

                {activeSkill.parameters.length === 0 ? (
                  <div className="p-4 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center text-xs text-slate-500">
                    Cette compétence d'automatisation s'exécute de manière statique sans aucun argument requis.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {activeSkill.parameters.map((p) => (
                      <div key={p.name} className="space-y-1.5 p-3 bg-slate-950/30 border border-slate-850 rounded-lg">
                        <label htmlFor={p.name} className="font-semibold text-slate-300 block">{p.label}</label>
                        
                        {p.type === "text" && (
                          <input
                            id={p.name}
                            type="text"
                            placeholder={p.placeholder}
                            value={paramValues[p.name] || ""}
                            onChange={(e) => handleParamChange(p.name, e.target.value)}
                            className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                          />
                        )}

                        {p.type === "number" && (
                          <input
                            id={p.name}
                            type="number"
                            placeholder={p.placeholder}
                            value={paramValues[p.name] || ""}
                            onChange={(e) => handleParamChange(p.name, e.target.value)}
                            className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                          />
                        )}

                        {p.type === "select" && (
                          <select
                            id={p.name}
                            value={paramValues[p.name] || ""}
                            onChange={(e) => handleParamChange(p.name, e.target.value)}
                            className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-300"
                          >
                            {p.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {p.type === "checkbox" && (
                          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={paramValues[p.name] === "true"}
                              onChange={(e) => handleParamChange(p.name, e.target.checked ? "true" : "false")}
                              className="w-4 h-4 accent-indigo-500 rounded bg-slate-950 border-slate-850"
                            />
                            <span className="text-slate-400 text-[11px]">Activer l'option</span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Real-time Compiled command preview */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Aperçu du script compilé</span>
                <div className="p-3 bg-slate-950 rounded-lg font-mono text-[11px] text-emerald-400/95 break-all border border-slate-850/80">
                  $ {getResolvedCommand()}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sera envoyé dans le terminal PTY actif en arrière-plan</span>
                </div>

                <button
                  onClick={handleExecute}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold text-xs rounded-lg shadow-lg shadow-indigo-950/20 transition-all flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Exécuter la Compétence
                </button>
              </div>

            </div>

            {/* Local Session Executed commands List */}
            {recentRuns.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Historique d'exécution des compétences
                </span>
                <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                  {recentRuns.map((run) => (
                    <div key={run.id} className="p-2.5 bg-slate-950 rounded border border-slate-850 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{run.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono">({run.timestamp})</span>
                        </div>
                        <code className="block p-1 bg-slate-900 font-mono text-[10px] text-emerald-400 truncate border border-slate-850/50">
                          {run.script}
                        </code>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> OK
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explainer / Informational box */}
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-200">Fonctionnement du Moteur de Compétences (Skills Engine)</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Le moteur d'exécution compile en temps réel les variables d'arguments saisies dans les modèles de scripts avant de les envoyer directement via notre pont IPC de processus léger asynchrone Tauri Rust dans la PTY. Vous pouvez intégrer vos propres compétences et stocker des macros complexes pour toutes vos tâches régulières de maintenance ou d'orchestration.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
