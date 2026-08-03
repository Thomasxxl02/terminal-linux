import React, { useEffect, useState, useCallback, Suspense, lazy } from "react";
import { Sidebar } from "./components/Sidebar";
import { TerminalTabs } from "./components/TerminalTabs";
import { TerminalView } from "./components/TerminalView";
import { MaintenanceHub } from "./components/MaintenanceHub";
import { TauriRustArchitect } from "./components/TauriRustArchitect";
import { SnippetsLibrary } from "./components/SnippetsLibrary";
import { SkillsHub } from "./components/SkillsHub";
import { SystemMonitorModal } from "./components/SystemMonitorModal";
import { CommandPalette } from "./components/CommandPalette";
import { ProfileManager } from "./components/ProfileManager";
import { PlaybookSequencer } from "./components/PlaybookSequencer";
import { SshHostManager } from "./components/SshHostManager";
import { SshTunnelManager } from "./components/SshTunnelManager";
import { TerminalSessionInfo, SystemStats, ShellProfile, SavedTabSession, SshHost } from "./types";

const MonacoFileEditor = lazy(() =>
  import("./components/MonacoFileEditor").then((m) => ({ default: m.MonacoFileEditor }))
);

export default function App() {
  const [activeView, setActiveView] = useState<string>("terminal");
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<string>("dracula");
  const [fontSize, setFontSize] = useState<number>(14);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // File path state to open directly into Monaco Editor
  const [monacoFilePath, setMonacoFilePath] = useState<string>("");

  // Split View Mode: "single", "horizontal" (top/bottom), "vertical" (left/right)
  const [splitMode, setSplitMode] = useState<"single" | "horizontal" | "vertical">("single");

  // Command Palette State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Notification State
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);

  // Request browser notifications permission
  const handleRequestNotifications = () => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        setNotificationsEnabled(!notificationsEnabled);
      } else {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            setNotificationsEnabled(true);
            new Notification("🟢 Notifications Activées", {
              body: "Vous recevrez des alertes quand des tâches longues se terminent dans le PTY Terminal.",
            });
          }
        });
      }
    }
  };

  // Keyboard shortcut listener for Ctrl+Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch PTY sessions list from server
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/pty/sessions");
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        if (data.sessions.length > 0 && !activeSessionId) {
          setActiveSessionId(data.sessions[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch terminal sessions", e);
    }
  }, [activeSessionId]);

  // Fetch System Statistics
  const fetchSystemStats = useCallback(async () => {
    try {
      const res = await fetch("/api/system/stats");
      const data = await res.json();
      setSystemStats(data);
    } catch (e) {
      console.error("Failed to fetch system stats", e);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchSystemStats();

    const interval = setInterval(() => {
      fetchSystemStats();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchSessions, fetchSystemStats]);

  // Create new PTY Session
  const handleCreateSession = async () => {
    try {
      const sessionCount = sessions.length + 1;
      const res = await fetch("/api/pty/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Terminal #${sessionCount} - Bash` }),
      });
      const newSess = await res.json();
      if (newSess.id) {
        setSessions((prev) => [...prev, newSess]);
        setActiveSessionId(newSess.id);
        setActiveView("terminal");
      }
    } catch (e) {
      console.error("Failed to create session", e);
    }
  };

  // Close PTY Session
  const handleCloseSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/pty/${id}`, { method: "DELETE" });
      setSessions((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        setActiveSessionId((currentActive) =>
          currentActive === id ? (updated.length > 0 ? updated[0].id : null) : currentActive
        );
        return updated;
      });
    } catch (e) {
      console.error("Failed to close session", e);
    }
  }, []);

  // Execute Command in active terminal
  const handleExecuteInTerminal = useCallback(async (command: string, specificSessionId?: string) => {
    let targetId = specificSessionId || activeSessionId;

    if (!targetId || !sessions.some((s) => s.id === targetId)) {
      const res = await fetch("/api/pty/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Terminal Maintenance - Bash` }),
      });
      const newSess = await res.json();
      targetId = newSess.id;
      setSessions((prev) => [...prev, newSess]);
      setActiveSessionId(targetId);
    }

    setActiveView("terminal");

    const cmdWithNewline = command.endsWith("\n") ? command : command + "\n";
    fetch(`/api/pty/${targetId}/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: cmdWithNewline }),
    }).catch(() => {});
  }, [activeSessionId, sessions]);

  // Launch terminal session with custom profile
  const handleLaunchProfile = useCallback(async (profile: ShellProfile) => {
    try {
      const res = await fetch("/api/pty/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          cwd: profile.cwd,
          shell: profile.shell,
          env: profile.env,
        }),
      });
      const newSess = await res.json();
      setSessions((prev) => [...prev, newSess]);
      setActiveSessionId(newSess.id);
      setActiveView("terminal");

      if (profile.startupScript) {
        setTimeout(() => {
          handleExecuteInTerminal(profile.startupScript!, newSess.id);
        }, 800);
      }
    } catch (err) {
      console.error("Failed to launch profile session:", err);
    }
  }, [handleExecuteInTerminal]);

  // Restore saved tab sessions
  const handleRestoreSavedTabs = useCallback(async (savedTabs: SavedTabSession[]) => {
    for (const tab of savedTabs) {
      try {
        const res = await fetch("/api/pty/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tab.name,
            cwd: tab.cwd,
            shell: tab.shell,
          }),
        });
        const newSess = await res.json();
        setSessions((prev) => [...prev.filter((s) => s.id !== newSess.id), newSess]);
        setActiveSessionId(newSess.id);
      } catch (e) {
        console.error("Failed to restore tab session:", e);
      }
    }
    setActiveView("terminal");
  }, []);

  // Launch SSH Session in new PTY tab
  const handleLaunchSshSession = useCallback(async (host: SshHost) => {
    let cmd = `ssh `;
    if (host.port !== 22) cmd += `-p ${host.port} `;
    if (host.authType === "key" && host.privateKeyPath) cmd += `-i "${host.privateKeyPath}" `;
    if (host.tunnels && host.tunnels.length > 0) {
      host.tunnels.forEach((t) => {
        cmd += `-L ${t} `;
      });
    }
    cmd += `${host.username}@${host.host}`;

    try {
      const res = await fetch("/api/pty/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `SSH: ${host.name}`,
          shell: "bash",
          cwd: "~",
        }),
      });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) => [...prev, data.session]);
        setActiveSessionId(data.session.id);
        setActiveView("terminal");

        setTimeout(() => {
          handleExecuteInTerminal(cmd, data.session.id);
        }, 600);
      }
    } catch (e) {
      console.error("Failed to launch SSH session", e);
    }
  }, [handleExecuteInTerminal]);

  // Open File into Monaco Editor from Terminal Explorer
  const handleOpenMonacoFile = useCallback((filePath: string) => {
    setMonacoFilePath(filePath);
    setActiveView("monaco");
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const secondarySession = sessions.find((s) => s.id !== activeSessionId) || sessions[0];

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
      {/* Command Palette Overlay */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveView={setActiveView}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleCreateSession}
        onExecuteMaintenance={handleExecuteInTerminal}
        onThemeChange={setActiveThemeId}
        splitMode={splitMode}
        setSplitMode={setSplitMode}
        notificationsEnabled={notificationsEnabled}
        onRequestNotifications={handleRequestNotifications}
      />

      {/* Sidebar Component */}
      {!isFullscreen && (
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onCreateSession={handleCreateSession}
          onCloseSession={handleCloseSession}
          systemStats={systemStats}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-slate-950 overflow-hidden">
        {/* Render View Content */}
        {activeView === "terminal" && (
          <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
            <TerminalTabs
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSessionId}
              onCreateSession={handleCreateSession}
              onCloseSession={handleCloseSession}
              onRefreshSessions={fetchSessions}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
              splitMode={splitMode}
              setSplitMode={setSplitMode}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
              notificationsEnabled={notificationsEnabled}
              onRequestNotifications={handleRequestNotifications}
            />

            <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-950">
              {activeSession ? (
                splitMode === "single" ? (
                  <TerminalView
                    key={activeSession.id}
                    session={activeSession}
                    activeThemeId={activeThemeId}
                    onThemeChange={setActiveThemeId}
                    fontSize={fontSize}
                    setFontSize={setFontSize}
                    notificationsEnabled={notificationsEnabled}
                    onOpenMonacoFile={handleOpenMonacoFile}
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
                        onThemeChange={setActiveThemeId}
                        fontSize={fontSize}
                        setFontSize={setFontSize}
                        notificationsEnabled={notificationsEnabled}
                        onOpenMonacoFile={handleOpenMonacoFile}
                      />
                    </div>

                    {/* Secondary Split Pane */}
                    <div className="flex-1 h-full min-w-0 min-h-0 relative">
                      {secondarySession && secondarySession.id !== activeSession.id ? (
                        <TerminalView
                          key={`secondary-${secondarySession.id}`}
                          session={secondarySession}
                          activeThemeId={activeThemeId}
                          onThemeChange={setActiveThemeId}
                          fontSize={fontSize}
                          setFontSize={setFontSize}
                          notificationsEnabled={notificationsEnabled}
                          onOpenMonacoFile={handleOpenMonacoFile}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 bg-slate-900/40">
                          <p className="mb-3 text-xs font-mono text-slate-400">
                            Session secondaire non sélectionnée
                          </p>
                          <button
                            onClick={handleCreateSession}
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
                    onClick={handleCreateSession}
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
          <SshHostManager
            onExecuteInTerminal={handleExecuteInTerminal}
            onLaunchSshSession={handleLaunchSshSession}
            sessions={sessions}
            activeSessionId={activeSessionId}
          />
        )}

        {activeView === "tunnels" && (
          <SshTunnelManager
            onExecuteInTerminal={handleExecuteInTerminal}
            sessions={sessions}
            activeSessionId={activeSessionId}
          />
        )}

        {activeView === "profiles" && (
          <ProfileManager
            onLaunchProfile={handleLaunchProfile}
            activeSessions={sessions}
            onRestoreSavedTabs={handleRestoreSavedTabs}
          />
        )}

        {activeView === "playbooks" && (
          <PlaybookSequencer
            sessions={sessions}
            activeSessionId={activeSessionId}
            onExecuteCommandInTerminal={handleExecuteInTerminal}
            onOpenTerminalView={() => setActiveView("terminal")}
          />
        )}

        {activeView === "maintenance" && (
          <MaintenanceHub
            sessions={sessions}
            activeSessionId={activeSessionId}
            onExecuteInTerminal={handleExecuteInTerminal}
          />
        )}

        {activeView === "monaco" && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-full text-slate-400 font-mono text-xs bg-slate-950 p-6 space-y-3">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p>Chargement de l'éditeur Monaco...</p>
              </div>
            }
          >
            <MonacoFileEditor
              onExecuteInTerminal={handleExecuteInTerminal}
              initialFilePath={monacoFilePath}
            />
          </Suspense>
        )}

        {activeView === "tauri" && <TauriRustArchitect />}

        {activeView === "skills" && (
          <SkillsHub onExecuteInTerminal={handleExecuteInTerminal} />
        )}

        {activeView === "snippets" && (
          <SnippetsLibrary onExecuteInTerminal={handleExecuteInTerminal} />
        )}

        {activeView === "stats" && (
          <SystemMonitorModal stats={systemStats} onRefresh={fetchSystemStats} />
        )}
      </main>
    </div>
  );
}

