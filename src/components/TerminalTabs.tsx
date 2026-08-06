import React from "react";
import {
  Plus,
  X,
  Terminal,
  RefreshCw,
  Maximize2,
  Minimize2,
  Columns,
  Rows,
  Square,
  Command,
  Bell,
  BellOff
} from "lucide-react";
import { TerminalSessionInfo } from "../types";

interface TerminalTabsProps {
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onCloseSession: (id: string) => void;
  onRefreshSessions?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  splitMode?: "single" | "horizontal" | "vertical";
  setSplitMode?: (mode: "single" | "horizontal" | "vertical") => void;
  onOpenCommandPalette?: () => void;
  notificationsEnabled?: boolean;
  onRequestNotifications?: () => void;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onCloseSession,
  onRefreshSessions,
  isFullscreen,
  onToggleFullscreen,
  splitMode = "single",
  setSplitMode,
  onOpenCommandPalette,
  notificationsEnabled,
  onRequestNotifications,
}) => {
  return (
    <div className="flex items-center justify-between bg-slate-950 border-b border-slate-800 px-2 select-none h-10 shrink-0">
      {/* Scrollable Tabs List */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 flex-1">
        {sessions.map((session) => {
          const isActive = activeSessionId === session.id;
          return (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer text-xs font-mono transition-all border-t border-x ${
                isActive
                  ? "bg-slate-900 text-emerald-400 border-slate-700 shadow-inner font-semibold"
                  : "bg-slate-950/60 text-slate-400 border-transparent hover:bg-slate-900/50 hover:text-slate-200"
              }`}
            >
              <Terminal className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
              <span className="truncate max-w-[140px]">{session.name}</span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseSession(session.id);
                }}
                className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                  isActive ? "hover:bg-slate-800 text-slate-400 hover:text-red-400" : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
                title="Fermer cet onglet"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* Add New Tab Button */}
        <button
          onClick={onCreateSession}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-900 rounded-md transition-colors"
          title="Ouvrir un nouvel onglet terminal (/bin/bash)"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-medium hidden sm:inline">Nouveau</span>
        </button>
      </div>

      {/* Control Actions & Split Layout Switcher */}
      <div className="flex items-center gap-1 border-l border-slate-800 pl-2 ml-2">
        {/* Command Palette button */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded transition-colors"
            title="Ouvrir la Palette de Commandes (Ctrl+Maj+P)"
          >
            <Command className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline font-semibold">Ctrl+Maj+P</span>
          </button>
        )}

        {/* Split Controls */}
        {setSplitMode && (
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5">
            <button
              onClick={() => setSplitMode("single")}
              className={`p-1 rounded ${
                splitMode === "single"
                  ? "bg-slate-800 text-emerald-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Vue Unique"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSplitMode("horizontal")}
              className={`p-1 rounded ${
                splitMode === "horizontal"
                  ? "bg-slate-800 text-emerald-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Division Horizontale (Haut / Bas)"
            >
              <Rows className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSplitMode("vertical")}
              className={`p-1 rounded ${
                splitMode === "vertical"
                  ? "bg-slate-800 text-emerald-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Division Verticale (Côte à Côte)"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Notification toggle */}
        {onRequestNotifications && (
          <button
            onClick={onRequestNotifications}
            className={`p-1.5 rounded transition-colors ${
              notificationsEnabled
                ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
            title={
              notificationsEnabled
                ? "Notifications système activées pour la fin de processus"
                : "Activer les notifications système de fin de processus"
            }
          >
            {notificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
        )}

        {onRefreshSessions && (
          <button
            onClick={onRefreshSessions}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded transition-colors"
            title="Rafraîchir les sessions"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded transition-colors"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
};
