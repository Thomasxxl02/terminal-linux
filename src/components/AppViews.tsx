import React, { Suspense } from "react";
import { TerminalTabs } from "./TerminalTabs";
import { TerminalView } from "./TerminalView";
import {
  LazyMaintenanceHub,
  LazyTauriRustArchitect,
  LazySnippetsLibrary,
  LazySkillsHub,
  LazySystemMonitorModal,
  LazyProfileManager,
  LazyPlaybookSequencer,
  LazySshHostManager,
  LazySshTunnelManager,
  LazyLogsStreamer,
  LazyWebShortcutsManager,
  LazyMonacoFileEditor,
} from "./lazy";
import { TerminalSessionInfo, SystemStats, ShellProfile, SavedTabSession, SshHost } from "../types";

interface AppViewsProps {
  activeView: string;
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  activeSession?: TerminalSessionInfo;
  secondarySession?: TerminalSessionInfo;
  splitMode: "single" | "horizontal" | "vertical";
  isFullscreen: boolean;
  notificationsEnabled: boolean;
  fontSize: number;
  activeThemeId: string;
  monacoFilePath: string;
  systemStats: SystemStats | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => Promise<void>;
  onCloseSession: (id: string) => void;
  onRefreshSessions: () => Promise<void>;
  onToggleFullscreen: () => void;
  onOpenCommandPalette: () => void;
  onRequestNotifications: () => void;
  onThemeChange: (id: string) => void;
  setFontSize: (size: number) => void;
  onSetSplitMode: (mode: "single" | "horizontal" | "vertical") => void;
  onOpenMonacoFile: (path: string) => void;
  onTerminalOutput: (data: string) => void;
  onExecuteInTerminal: (command: string, sessionId?: string) => Promise<void>;
  onLaunchSshSession: (host: SshHost) => void;
  onLaunchProfile: (profile: ShellProfile) => void;
  onRestoreSavedTabs: (tabs: SavedTabSession[]) => void;
  onOpenTerminalView: () => void;
  subscribeOutput: (fn: (data: string) => void) => () => void;
  onRefreshStats: () => Promise<void>;
}

/** Fallback de chargement affiché pendant le lazy-load d'une vue. */
function ViewFallback({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center h-full text-slate-500 text-xs font-mono">
      Chargement de {label}...
    </div>
  );
}

/**
 * Rendu des vues principales (extrait de App.tsx) : terminal (onglets +
 * split), carnet SSH, tunnels, profils, playbooks, maintenance, Monaco,
 * logs, architecture Rust, skills, snippets, raccourcis web et ressources.
 */
export const AppViews: React.FC<AppViewsProps> = ({
  activeView,
  sessions,
  activeSessionId,
  activeSession,
  secondarySession,
  splitMode,
  isFullscreen,
  notificationsEnabled,
  fontSize,
  activeThemeId,
  monacoFilePath,
  systemStats,
  onSelectSession,
  onCreateSession,
  onCloseSession,
  onRefreshSessions,
  onToggleFullscreen,
  onOpenCommandPalette,
  onRequestNotifications,
  onThemeChange,
  setFontSize,
  onSetSplitMode,
  onOpenMonacoFile,
  onTerminalOutput,
  onExecuteInTerminal,
  onLaunchSshSession,
  onLaunchProfile,
  onRestoreSavedTabs,
  onOpenTerminalView,
  subscribeOutput,
  onRefreshStats,
}) => {
  return (
    <>
      {/* Render View Content */}
      {activeView === "terminal" && (
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <TerminalTabs
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={onSelectSession}
            onCreateSession={onCreateSession}
            onCloseSession={onCloseSession}
            onRefreshSessions={onRefreshSessions}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            splitMode={splitMode}
            setSplitMode={onSetSplitMode}
            onOpenCommandPalette={onOpenCommandPalette}
            notificationsEnabled={notificationsEnabled}
            onRequestNotifications={onRequestNotifications}
          />

          <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-950">
            {activeSession ? (
              splitMode === "single" ? (
                <TerminalView
                  key={activeSession.id}
                  session={activeSession}
                  activeThemeId={activeThemeId}
                  onThemeChange={onThemeChange}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                  notificationsEnabled={notificationsEnabled}
                  onOpenMonacoFile={onOpenMonacoFile}
                  onOutput={onTerminalOutput}
                />
              ) : (
                /* Split View Container (Vertical or Horizontal) */
                <div
                  className={`w-full h-full flex ${
                    splitMode === "vertical" ? "flex-row divide-x" : "flex-col divide-y"
                  } divide-slate-800`}
                >
                  {/* Primary Pane */}
                  <div className="flex-1 h-full min-w-0 min-h-0 relative">
                    <TerminalView
                      key={`primary-${activeSession.id}`}
                      session={activeSession}
                      activeThemeId={activeThemeId}
                      onThemeChange={onThemeChange}
                      fontSize={fontSize}
                      setFontSize={setFontSize}
                      notificationsEnabled={notificationsEnabled}
                      onOpenMonacoFile={onOpenMonacoFile}
                      onOutput={onTerminalOutput}
                    />
                  </div>

                  {/* Secondary Split Pane */}
                  <div className="flex-1 h-full min-w-0 min-h-0 relative">
                    {secondarySession && secondarySession.id !== activeSession.id ? (
                      <TerminalView
                        key={`secondary-${secondarySession.id}`}
                        session={secondarySession}
                        activeThemeId={activeThemeId}
                        onThemeChange={onThemeChange}
                        fontSize={fontSize}
                        setFontSize={setFontSize}
                        notificationsEnabled={notificationsEnabled}
                        onOpenMonacoFile={onOpenMonacoFile}
                        onOutput={onTerminalOutput}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 bg-slate-900/40">
                        <p className="mb-3 text-xs font-mono text-slate-400">
                          Session secondaire non sélectionnée
                        </p>
                        <button
                          onClick={onCreateSession}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono rounded transition-colors"
                        >
                          Ouvrir un 2ème Terminal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
                <p className="mb-4 text-sm font-medium">Aucun terminal actif.</p>
                <button
                  onClick={onCreateSession}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                >
                  Ouvrir un nouveau Terminal Linux
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === "ssh" && (
        <Suspense fallback={<ViewFallback label="Carnet SSH" />}>
          <LazySshHostManager
            onExecuteInTerminal={onExecuteInTerminal}
            onLaunchSshSession={onLaunchSshSession}
          />
        </Suspense>
      )}

      {activeView === "tunnels" && (
        <Suspense fallback={<ViewFallback label="Tunnels" />}>
          <LazySshTunnelManager onExecuteInTerminal={onExecuteInTerminal} />
        </Suspense>
      )}

      {activeView === "profiles" && (
        <Suspense fallback={<ViewFallback label="Profils" />}>
          <LazyProfileManager
            onLaunchProfile={onLaunchProfile}
            activeSessions={sessions}
            onRestoreSavedTabs={onRestoreSavedTabs}
          />
        </Suspense>
      )}

      {activeView === "playbooks" && (
        <Suspense fallback={<ViewFallback label="Playbooks" />}>
          <LazyPlaybookSequencer
            sessions={sessions}
            activeSessionId={activeSessionId}
            onExecuteCommandInTerminal={onExecuteInTerminal}
            onOpenTerminalView={onOpenTerminalView}
            subscribeOutput={subscribeOutput}
          />
        </Suspense>
      )}

      {activeView === "maintenance" && (
        <Suspense fallback={<ViewFallback label="Maintenance" />}>
          <LazyMaintenanceHub
            sessions={sessions}
            activeSessionId={activeSessionId}
            onExecuteInTerminal={onExecuteInTerminal}
          />
        </Suspense>
      )}

      {activeView === "monaco" && (
        <Suspense fallback={<ViewFallback label="Éditeur Monaco" />}>
          <LazyMonacoFileEditor
            onExecuteInTerminal={onExecuteInTerminal}
            initialFilePath={monacoFilePath}
          />
        </Suspense>
      )}

      {activeView === "logs" && (
        <Suspense fallback={<ViewFallback label="Logs" />}>
          <LazyLogsStreamer />
        </Suspense>
      )}

      {activeView === "tauri" && (
        <Suspense fallback={<ViewFallback label="Architecture Rust" />}>
          <LazyTauriRustArchitect />
        </Suspense>
      )}

      {activeView === "skills" && (
        <Suspense fallback={<ViewFallback label="Skills" />}>
          <LazySkillsHub onExecuteInTerminal={onExecuteInTerminal} />
        </Suspense>
      )}

      {activeView === "snippets" && (
        <Suspense fallback={<ViewFallback label="Snippets" />}>
          <LazySnippetsLibrary onExecuteInTerminal={onExecuteInTerminal} />
        </Suspense>
      )}

      {activeView === "bookmarks" && (
        <Suspense fallback={<ViewFallback label="Raccourcis Web" />}>
          <LazyWebShortcutsManager
            onExecuteInTerminal={onExecuteInTerminal}
            sessions={sessions}
            activeSessionId={activeSessionId}
          />
        </Suspense>
      )}

      {activeView === "stats" && (
        <Suspense fallback={<ViewFallback label="Ressources" />}>
          <LazySystemMonitorModal stats={systemStats} onRefresh={onRefreshStats} />
        </Suspense>
      )}
    </>
  );
};
