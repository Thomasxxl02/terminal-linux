import React, { useState, useEffect } from "react";
import {
  Wrench,
  RefreshCw,
  Trash2,
  FileText,
  HardDrive,
  Cpu,
  Zap,
  Play,
  CheckCircle2,
  Plus,
  Shield,
  Terminal as TermIcon,
  Sparkles,
  Search,
  Activity,
  Server,
  HeartPulse,
  Info,
  Clock,
  ExternalLink,
  Sliders,
  AlertTriangle
} from "lucide-react";
import { MAINTENANCE_TASKS } from "../constants/snippets";
import { TerminalSessionInfo } from "../types";

interface MaintenanceHubProps {
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  onExecuteInTerminal: (command: string) => void;
}

interface CustomMacro {
  id: string;
  title: string;
  command: string;
  description: string;
  category: string;
}

interface ServiceAction {
  name: string;
  command: string;
  description: string;
}

export const MaintenanceHub: React.FC<MaintenanceHubProps> = ({
  sessions = [],
  activeSessionId = null,
  onExecuteInTerminal,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    activeSessionId || (sessions[0]?.id ?? "")
  );

  // Custom persistent macros
  const [customMacros, setCustomMacros] = useState<CustomMacro[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customCommand, setCustomCommand] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customCategory, setCustomCategory] = useState("Général");

  // Diagnostics state
  const [diagnosticCores, setDiagnosticCores] = useState("4");
  const [diagnosticLimit, setDiagnosticLimit] = useState("90");
  
  // Service controller target
  const [targetService, setTargetService] = useState("docker");

  // History & feedback state
  const [historyFeed, setHistoryFeed] = useState<{ id: string; command: string; timestamp: string; label: string }[]>([]);
  const [lastExecutedTask, setLastExecutedTask] = useState<string | null>(null);

  // Load custom macros from localStorage on init
  useEffect(() => {
    const saved = localStorage.getItem("terminal_maintenance_macros");
    if (saved) {
      try {
        setCustomMacros(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading maintenance macros", e);
      }
    } else {
      const defaultMacros: CustomMacro[] = [
        {
          id: "custom_1",
          title: "Intégrité Globale Système",
          description: "Inspecte l'espace disque, la RAM libre et la durée de fonctionnement.",
          command: "df -h && free -m && uptime",
          category: "Diagnostic",
        },
        {
          id: "custom_2",
          title: "Nettoyage du cache DNS",
          description: "Vide et réinitialise le cache de résolution de noms système.",
          command: "resolvectl flush-caches 2>/dev/null || systemctl restart systemd-resolved 2>/dev/null || echo 'DNS Cache Flushed'",
          category: "Réseau",
        },
      ];
      setCustomMacros(defaultMacros);
      localStorage.setItem("terminal_maintenance_macros", JSON.stringify(defaultMacros));
    }
  }, []);

  // Save custom macros to localStorage helper
  const saveMacros = (newMacros: CustomMacro[]) => {
    setCustomMacros(newMacros);
    localStorage.setItem("terminal_maintenance_macros", JSON.stringify(newMacros));
  };

  const handleRunTask = (command: string, taskId: string, label: string) => {
    onExecuteInTerminal(command);
    setLastExecutedTask(taskId);
    
    // Append to local activity log
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistoryFeed(prev => [
      { id: Date.now().toString(), command, timestamp: timeStr, label },
      ...prev.slice(0, 9) // Limit to last 10
    ]);

    setTimeout(() => setLastExecutedTask(null), 3000);
  };

  const handleAddMacro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() || !customCommand.trim()) return;

    const newMacro: CustomMacro = {
      id: `macro_${Date.now()}`,
      title: customTitle.trim(),
      description: customDescription.trim() || "Script de maintenance personnalisé.",
      command: customCommand.trim(),
      category: customCategory.trim() || "Général",
    };

    const updated = [...customMacros, newMacro];
    saveMacros(updated);

    setCustomTitle("");
    setCustomCommand("");
    setCustomDescription("");
    setCustomCategory("Général");
  };

  const handleDeleteMacro = (id: string) => {
    const filtered = customMacros.filter((m) => m.id !== id);
    saveMacros(filtered);
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "RefreshCw":
        return RefreshCw;
      case "Trash2":
        return Trash2;
      case "FileText":
        return FileText;
      case "HardDrive":
        return HardDrive;
      case "Cpu":
        return Cpu;
      case "Zap":
        return Zap;
      default:
        return Wrench;
    }
  };

  // Pre-compiled list of service-specific helpers
  const getServiceCommands = (serviceName: string): ServiceAction[] => {
    const name = serviceName.trim().toLowerCase();
    return [
      {
        name: "Statut Actuel",
        command: `systemctl status ${name} --no-pager || service ${name} status`,
        description: "Vérifie si le service tourne, ses PID et les derniers logs."
      },
      {
        name: "Redémarrer",
        command: `sudo systemctl restart ${name} || sudo service ${name} restart`,
        description: "Force l'arrêt et la relance propre du processus de service."
      },
      {
        name: "Arrêter le Service",
        command: `sudo systemctl stop ${name} || sudo service ${name} stop`,
        description: "Arrête immédiatement le service système cible."
      },
      {
        name: "Activer au Démarrage",
        command: `sudo systemctl enable ${name}`,
        description: "Configure systemd pour lancer automatiquement ce démon au boot."
      }
    ];
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-200 p-6 overflow-y-auto custom-scrollbar space-y-6 select-none">
      
      {/* Header Banner */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-6 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shadow-inner shrink-0">
            <Wrench className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 flex-wrap">
              Centre de Maintenance Linux Avancé
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Légèreté & Performance
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Déclenchez des routines d'administration système, purge de fichiers journaux, gestionnaires de services et diagnostic d'intégrité globale en un clic.
            </p>
          </div>
        </div>

        {/* Target terminal session selector */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 shrink-0 self-start xl:self-center">
          <TermIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-400 font-medium">Session cible :</span>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-slate-900 text-slate-200 border border-slate-800 rounded-lg px-3 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500"
          >
            {sessions.map((sess) => (
              <option key={sess.id} value={sess.id}>
                {sess.name} ({sess.shell})
              </option>
            ))}
            {sessions.length === 0 && <option value="">Aucun terminal connecté</option>}
          </select>
        </div>
      </div>

      {/* Main Grid: Workspaces */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Col 1 & 2: Quick tasks & Service Inspector */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Preset tasks row */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Macros de Maintenance Système
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MAINTENANCE_TASKS.map((task) => {
                const TaskIcon = getIcon(task.iconName);
                const isExecuted = lastExecutedTask === task.id;
                return (
                  <div
                    key={task.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                          {task.badge}
                        </span>
                        <TaskIcon className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <h4 className="font-bold text-xs text-slate-100">{task.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {task.description}
                      </p>
                    </div>

                    <div className="space-y-2 pt-3 mt-3 border-t border-slate-800/80">
                      <code className="block p-2 rounded bg-slate-950 font-mono text-[10px] text-emerald-400/90 truncate border border-slate-900">
                        $ {task.command}
                      </code>

                      <button
                        onClick={() => handleRunTask(task.command, task.id, task.title)}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          isExecuted
                            ? "bg-emerald-600 text-slate-950"
                            : "bg-emerald-500/10 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/20 hover:border-transparent"
                        }`}
                      >
                        {isExecuted ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Envoyé au terminal !
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            Exécuter la tâche
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Core System Services Manager */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="font-bold text-sm text-slate-100">Contrôleur de Services Linux</h4>
                  <p className="text-[10px] text-slate-400">Gérez l'état de vos démons et services système à la volée.</p>
                </div>
              </div>

              {/* Quick service toggle buttons */}
              <div className="flex items-center gap-1.5">
                {["docker", "nginx", "ssh", "systemd-journald"].map((srv) => (
                  <button
                    key={srv}
                    onClick={() => setTargetService(srv)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                      targetService === srv
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300"
                    }`}
                  >
                    {srv}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {getServiceCommands(targetService).map((action, i) => (
                <div key={i} className="bg-slate-950 p-3 border border-slate-850 rounded-lg flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-300 text-[11px] block">{action.name}</span>
                    <p className="text-[10px] text-slate-500 leading-normal">{action.description}</p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-900 space-y-2">
                    <code className="block p-1 text-[9px] font-mono text-emerald-500 bg-slate-900 rounded truncate">
                      {action.command}
                    </code>
                    <button
                      onClick={() => handleRunTask(action.command, `${targetService}-${i}`, `${targetService} - ${action.name}`)}
                      className="w-full py-1 text-[10px] bg-slate-900 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold rounded border border-emerald-500/10 transition-all flex items-center justify-center gap-1"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" /> Lancer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Col 3: Diagnostics suggestions & Custom Macro Manager */}
        <div className="space-y-6">
          
          {/* Diagnostic Suggestion Engine */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <HeartPulse className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="font-bold text-xs text-slate-100 uppercase tracking-wider">Docteur Système Interactif</h4>
                <p className="text-[9px] text-slate-500">Générez des scripts de diagnostic personnalisés.</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Dynamic inputs */}
              <div className="space-y-2 bg-slate-950/40 p-3 border border-slate-850 rounded-lg">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">Seuil d'alerte disque (%) :</label>
                  <input
                    type="number"
                    value={diagnosticLimit}
                    onChange={(e) => setDiagnosticLimit(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded px-2.5 py-1 text-[11px] font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">Nombre max de coeurs CPU stress :</label>
                  <select
                    value={diagnosticCores}
                    onChange={(e) => setDiagnosticCores(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded px-2.5 py-1 text-[11px] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="2">2 Cœurs</option>
                    <option value="4">4 Cœurs</option>
                    <option value="8">8 Cœurs</option>
                    <option value="16">16 Cœurs</option>
                  </select>
                </div>
              </div>

              {/* Generated Diagnostics Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => handleRunTask(
                    `df -h | awk '0+$5 > ${diagnosticLimit} {print "ALERTE: Espace disque critique sur " $6 " (" $5 ")"}'`,
                    "diag-disk",
                    "Alerte espace disque"
                  )}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg text-left transition-all hover:border-slate-700 flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-[11px] text-slate-200 block group-hover:text-emerald-400 transition-colors">Vérification Seuil Disque</span>
                    <p className="text-[9px] text-slate-500">Scan les partitions supérieures à {diagnosticLimit}% d'utilisation.</p>
                  </div>
                  <Play className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                </button>

                <button
                  onClick={() => handleRunTask(
                    `ps -eo pcpu,pmem,pid,user,args --sort=-pcpu | head -n ${diagnosticCores} | awk '{print "CPU %: " $1 " | PID: " $3 " | Command: " $5}'`,
                    "diag-cpu",
                    "Docteur CPU"
                  )}
                  className="w-full p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg text-left transition-all hover:border-slate-700 flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-[11px] text-slate-200 block group-hover:text-emerald-400 transition-colors">Docteur Processeurs</span>
                    <p className="text-[9px] text-slate-500">Inspecte les {diagnosticCores} processus CPU les plus chauds.</p>
                  </div>
                  <Play className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Persistent Custom Macro list & builder */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="font-bold text-xs text-slate-100 uppercase tracking-wider">Raccourcis Enregistrés</h4>
                <p className="text-[9px] text-slate-500">Vos raccourcis personnalisés persistants ({customMacros.length})</p>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar">
              {customMacros.map((macro) => (
                <div key={macro.id} className="p-2 bg-slate-950 rounded border border-slate-850 flex items-center justify-between text-xs group">
                  <div className="min-w-0 pr-2">
                    <span className="font-semibold text-slate-300 block truncate leading-tight">{macro.title}</span>
                    <span className="text-[9px] text-slate-500 block truncate font-mono mt-0.5">$ {macro.command}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRunTask(macro.command, macro.id, macro.title)}
                      className="p-1 bg-slate-900 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 rounded transition-all"
                      title="Exécuter"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                    <button
                      onClick={() => handleDeleteMacro(macro.id)}
                      className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {customMacros.length === 0 && (
                <div className="text-center p-3 text-slate-600 text-[10px]">Aucun raccourci enregistré.</div>
              )}
            </div>

            {/* Inline creation fields */}
            <form onSubmit={handleAddMacro} className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Nouveau Raccourci de Maintenance</span>
              
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nom"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                />
                <input
                  type="text"
                  placeholder="Catégorie (Optionnel)"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                />
              </div>

              <input
                type="text"
                placeholder="Description rapide..."
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
              />

              <input
                type="text"
                placeholder="Commande (ex: free -m)"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                className="w-full bg-slate-950 font-mono border border-slate-800 rounded px-2.5 py-1 text-[11px] focus:outline-none focus:border-emerald-500 text-emerald-400"
              />

              <button
                type="submit"
                disabled={!customTitle.trim() || !customCommand.trim()}
                className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded text-[10px] transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> Ajouter le Raccourci
              </button>
            </form>
          </div>

          {/* Activity Timeline Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Clock className="w-5 h-5 text-emerald-400" />
              <h4 className="font-bold text-xs text-slate-100 uppercase tracking-wider">Historique de la Session</h4>
            </div>

            <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar text-[11px]">
              {historyFeed.map((item) => (
                <div key={item.id} className="p-2 bg-slate-950 rounded border border-slate-850/80 flex items-start gap-2">
                  <span className="font-mono text-[9px] text-slate-500 bg-slate-900 px-1 py-0.5 rounded shrink-0">{item.timestamp}</span>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-300 block leading-tight">{item.label}</span>
                    <code className="text-[10px] text-emerald-500 font-mono truncate block mt-0.5">{item.command}</code>
                  </div>
                </div>
              ))}

              {historyFeed.length === 0 && (
                <div className="text-center p-4 text-slate-600">Aucune commande exécutée pour l'instant.</div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
