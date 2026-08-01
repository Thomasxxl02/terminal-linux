import React, { useState } from "react";
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
  Sparkles
} from "lucide-react";
import { MAINTENANCE_TASKS } from "../constants/snippets";
import { TerminalSessionInfo } from "../types";

interface MaintenanceHubProps {
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  onExecuteInTerminal: (command: string) => void;
}

export const MaintenanceHub: React.FC<MaintenanceHubProps> = ({
  sessions = [],
  activeSessionId = null,
  onExecuteInTerminal,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    activeSessionId || (sessions[0]?.id ?? "")
  );

  const [customTitle, setCustomTitle] = useState("");
  const [customCommand, setCustomCommand] = useState("");
  const [customMacros, setCustomMacros] = useState<
    { id: string; title: string; command: string }[]
  >([
    {
      id: "custom_1",
      title: "Vérification de l'intégrité du système",
      command: "df -h && free -m && uptime",
    },
    {
      id: "custom_2",
      title: "Flush DNS & Reconnexion Réseau",
      command: "resolvectl flush-caches 2>/dev/null || systemctl restart systemd-resolved 2>/dev/null || echo 'DNS Flush'",
    },
  ]);

  const [lastExecutedTask, setLastExecutedTask] = useState<string | null>(null);

  const handleRunTask = (command: string, taskId: string) => {
    onExecuteInTerminal(command);
    setLastExecutedTask(taskId);
    setTimeout(() => setLastExecutedTask(null), 3000);
  };

  const handleAddMacro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle || !customCommand) return;
    setCustomMacros([
      ...customMacros,
      {
        id: `macro_${Date.now()}`,
        title: customTitle,
        command: customCommand,
      },
    ]);
    setCustomTitle("");
    setCustomCommand("");
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

  return (
    <div className="flex-1 bg-slate-950 text-slate-200 p-6 overflow-y-auto custom-scrollbar space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg">
            <Wrench className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Centre de Maintenance Linux
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                APT & Purge
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Exécutez rapidement des tâches de mise à jour système, de nettoyage de cache et de purge de journaux en un clic.
            </p>
          </div>
        </div>

        {/* Active Target Terminal Selector */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
          <TermIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-400 font-medium">Terminal Cible :</span>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-slate-900 text-slate-200 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500"
          >
            {sessions.map((sess) => (
              <option key={sess.id} value={sess.id}>
                {sess.name} ({sess.shell})
              </option>
            ))}
            {sessions.length === 0 && <option value="">Aucun terminal disponible</option>}
          </select>
        </div>
      </div>

      {/* Preset System Maintenance Tasks */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider font-mono flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Tâches de Maintenance Intégrées
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MAINTENANCE_TASKS.map((task) => {
            const TaskIcon = getIcon(task.iconName);
            const isExecuted = lastExecutedTask === task.id;
            return (
              <div
                key={task.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all hover:shadow-md group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {task.badge}
                    </span>
                    <TaskIcon className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <h4 className="font-semibold text-sm text-slate-100 mb-1">{task.title}</h4>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">{task.description}</p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-emerald-400/90 truncate border border-slate-800/60">
                    $ {task.command}
                  </div>

                  <button
                    onClick={() => handleRunTask(task.command, task.id)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      isExecuted
                        ? "bg-emerald-600 text-slate-950"
                        : "bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40"
                    }`}
                  >
                    {isExecuted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Envoyé au terminal !
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
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

      {/* Custom Script & Macro Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Left: Create Custom Macro */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            Créer un Raccourci Personnalisé
          </h3>

          <form onSubmit={handleAddMacro} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nom du raccourci</label>
              <input
                type="text"
                placeholder="ex: Nettoyage Docker + Cache"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Commande Bash</label>
              <textarea
                placeholder="ex: docker system prune -af && echo 'Done'"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 text-emerald-400 font-mono border border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={!customTitle || !customCommand}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Enregistrer le Raccourci
            </button>
          </form>
        </div>

        {/* Right: Custom Saved Macros List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-emerald-400" />
            Vos Raccourcis de Maintenance Personnalisés ({customMacros.length})
          </h3>

          <div className="space-y-3">
            {customMacros.map((macro) => (
              <div
                key={macro.id}
                className="flex items-center justify-between gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-slate-200">{macro.title}</h4>
                  <p className="font-mono text-[11px] text-emerald-400 truncate mt-0.5">
                    $ {macro.command}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRunTask(macro.command, macro.id)}
                    className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-medium text-xs rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1.5"
                  >
                    <Play className="w-3 h-3 fill-current" /> Exécuter
                  </button>
                  <button
                    onClick={() =>
                      setCustomMacros(customMacros.filter((m) => m.id !== macro.id))
                    }
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
