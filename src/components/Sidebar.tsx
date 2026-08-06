import React from "react";
import {
  Terminal,
  Wrench,
  FileCode,
  Box,
  Bookmark,
  Activity,
  Plus,
  Trash2,
  Cpu,
  HardDrive,
  ShieldAlert,
  ChevronRight,
  Monitor,
  Sliders,
  Layers,
  Key,
  Zap,
  Sparkles,
  FileText,
  Globe
} from "lucide-react";

import { TerminalSessionInfo, SystemStats } from "../types";

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onCloseSession: (id: string) => void;
  systemStats: SystemStats | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onCloseSession,
  systemStats,
}) => {
  const navItems = [
    { id: "terminal", label: "Terminaux PTY", icon: Terminal },
    { id: "ssh", label: "Carnet SSH & Tunnels", icon: Key },
    { id: "tunnels", label: "Tunnels & Reverse Proxy", icon: Zap },
    { id: "profiles", label: "Profils & Shells", icon: Sliders },
    { id: "playbooks", label: "Automation Playbooks", icon: Layers },
    { id: "maintenance", label: "Maintenance Système", icon: Wrench },
    { id: "monaco", label: "Éditeur Monaco", icon: FileCode },
    { id: "logs", label: "Visualiseur de Logs", icon: FileText },
    { id: "tauri", label: "Architectures", icon: Box },
    { id: "skills", label: "Skills / Fonctions", icon: Sparkles },
    { id: "snippets", label: "Bibliothèque Snippets", icon: Bookmark },
    { id: "bookmarks", label: "Raccourcis Web", icon: Globe },
    { id: "stats", label: "Ressources Système", icon: Activity },

  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-screen select-none shrink-0">
      {/* Brand & Title */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-950/30">
            <Terminal className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 text-sm tracking-tight flex items-center gap-1.5">
              Terminal Studio
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Tauri PTY
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Émulateur Linux & Rust</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="p-3 border-b border-slate-800/60">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold px-2 mb-2">
          Navigation
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active PTY Sessions List */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            Sessions PTY Actives ({sessions.length})
          </span>
          <button
            onClick={onCreateSession}
            title="Nouveau Terminal"
            className="p-1 rounded hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {sessions.map((sess) => {
            const isCurrent = activeSessionId === sess.id && activeView === "terminal";
            return (
              <div
                key={sess.id}
                onClick={() => {
                  onSelectSession(sess.id);
                  setActiveView("terminal");
                }}
                className={`group flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer text-xs transition-all border ${
                  isCurrent
                    ? "bg-slate-800 text-slate-100 border-slate-700 shadow-sm"
                    : "bg-slate-950/30 text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <div className="truncate">
                    <div className="font-medium truncate text-slate-200">{sess.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {sess.shell} • {sess.cwd.split("/").pop() || "/"}
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseSession(sess.id);
                  }}
                  title="Fermer ce terminal"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {sessions.length === 0 && (
            <div className="p-3 text-center border border-dashed border-slate-800 rounded-lg text-slate-400 text-xs">
              <p className="mb-2">Aucune session active</p>
              <button
                onClick={onCreateSession}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-medium rounded transition-colors"
              >
                <Plus className="w-3 h-3" /> Créer Terminal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mini System Resource Monitor Widget */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            Hôte Linux
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {systemStats ? `${systemStats.cpus} vCPUs` : "Chargement..."}
          </span>
        </div>

        {systemStats ? (
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span>RAM</span>
                <span className="text-slate-300 font-bold">
                  {systemStats.memUsagePercent}% ({(systemStats.usedMem / (1024 * 1024 * 1024)).toFixed(1)}GB / {(systemStats.totalMem / (1024 * 1024 * 1024)).toFixed(1)}GB)
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    systemStats.memUsagePercent > 80
                      ? "bg-red-500"
                      : systemStats.memUsagePercent > 60
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${systemStats.memUsagePercent}%` }}
                ></div>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Charge: {systemStats.loadavg[0]?.toFixed(2)}</span>
              <span>Uptime: {Math.floor(systemStats.uptime / 3600)}h</span>
            </div>
          </div>
        ) : (
          <div className="animate-pulse h-8 bg-slate-800/50 rounded"></div>
        )}
      </div>
    </aside>
  );
};
