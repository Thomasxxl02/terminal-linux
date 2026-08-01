import React from "react";
import { Activity, Cpu, HardDrive, Server, Clock, RefreshCw } from "lucide-react";
import { SystemStats } from "../types";

interface SystemMonitorModalProps {
  stats: SystemStats | null;
  onRefresh: () => void;
}

export const SystemMonitorModal: React.FC<SystemMonitorModalProps> = ({
  stats,
  onRefresh,
}) => {
  if (!stats) {
    return (
      <div className="flex-1 bg-slate-950 text-slate-200 p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          Chargement des télémétries système...
        </div>
      </div>
    );
  }

  const formatUptime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const ramUsedGB = (stats.usedMem / (1024 * 1024 * 1024)).toFixed(2);
  const ramTotalGB = (stats.totalMem / (1024 * 1024 * 1024)).toFixed(2);

  return (
    <div className="flex-1 bg-slate-950 text-slate-200 p-6 overflow-y-auto custom-scrollbar space-y-6">
      <div className="flex items-center justify-between p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">
              Statistiques & Ressources du Système Linux
            </h2>
            <p className="text-xs text-slate-400">
              Surveillance en temps réel de la charge processeur, mémoire et métriques système.
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Cpu className="w-4 h-4" /> Processeur
            </span>
            <span>{stats.cpus} Coeurs</span>
          </div>
          <div className="text-lg font-bold text-slate-100 truncate">{stats.cpuModel}</div>
          <div className="text-xs text-slate-400 font-mono">
            Load Avg : {stats.loadavg.map((l) => l.toFixed(2)).join(" / ")}
          </div>
        </div>

        {/* RAM Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Server className="w-4 h-4" /> Mémoire RAM
            </span>
            <span>{stats.memUsagePercent}%</span>
          </div>
          <div className="text-lg font-bold text-slate-100">
            {ramUsedGB} GB / {ramTotalGB} GB
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                stats.memUsagePercent > 80 ? "bg-red-500" : "bg-emerald-500"
              }`}
              style={{ width: `${stats.memUsagePercent}%` }}
            />
          </div>
        </div>

        {/* Uptime Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Clock className="w-4 h-4" /> Temps de fonctionnement
            </span>
          </div>
          <div className="text-lg font-bold text-slate-100">{formatUptime(stats.uptime)}</div>
          <div className="text-xs text-slate-400 font-mono">Hôte : {stats.hostname}</div>
        </div>

        {/* System OS Info */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-purple-400">
              <HardDrive className="w-4 h-4" /> Noyau & Système
            </span>
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono">
            {stats.platform} ({stats.arch})
          </div>
          <div className="text-xs text-slate-400 font-mono truncate">{stats.release}</div>
        </div>
      </div>
    </div>
  );
};
