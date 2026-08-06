import React, { useEffect, useState, useCallback, Suspense } from "react";
import { Sidebar } from "./components/Sidebar";
import { TerminalTabs } from "./components/TerminalTabs";
import { TerminalView } from "./components/TerminalView";
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
} from "./components/lazy";
import { CommandPalette } from "./components/CommandPalette";
import { TerminalSessionInfo, SystemStats, ShellProfile, SavedTabSession, SshHost } from "./types";
import {
  apiFetch,
  clearAuth,
  getToken,
  getRole,
  isAuthenticated,
  login,
  logout,
  setAuth,
} from "./lib/api";
import { errMsg } from "./lib/errors";
import { AuthScreen } from "./components/AuthScreen";
import {
  closePtySessionWeb,
  createPtySessionWeb,
  getSystemStatsWeb,
  listProcessesWeb,
  isTauri,
  listPtySessionsWeb,
  tauriInvoke,
} from "./lib/tauri";

/** Fallback de chargement affiché pendant le lazy-load d'une vue. */
function ViewFallback({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 font-mono text-xs bg-slate-950 p-6 space-y-3">
      <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      <p>Chargement : {label}...</p>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<string>("terminal");
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<string>("dracula");
  const [fontSize, setFontSize] = useState<number>(14);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auth state : l'app affiche l'écran de connexion si le serveur exige un JWT
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [authRequired, setAuthRequired] = useState<boolean>(true);
  // Rôle réactif (mis à jour au login/logout pour le badge Sidebar)
  const [userRole, setUserRole] = useState<string | null>(() => getRole());

  // Mode Tauri : pas de serveur HTTP → l'authentification JWT n'a pas de
  // sens (les commandes Rust sont locales et ne vérifient aucun token).
  // L'écran de connexion est désactivé pour ne pas bloquer l'app (le login
  // ferait un fetch vers /api/auth/login qui n'existe pas en desktop).
  useEffect(() => {
    if (isTauri()) {
      setAuthRequired(false);
      setAuthChecked(true);
      clearAuth();
      setUserRole(null);
    }
  }, []);

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
      if (isTauri()) {
        const tauriSessions = await listPtySessionsWeb();
        setSessions(tauriSessions);
        if (tauriSessions.length > 0 && !activeSessionId) {
          setActiveSessionId(tauriSessions[0].id);
        }
        return;
      }
      const res = await apiFetch("/api/pty/sessions");
      if (res.status === 401) {
        // JWT manquant ou expiré → exiger une connexion
        clearAuth();
        setAuthRequired(true);
        setAuthChecked(true);
        return;
      }
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

  // Au montage : vérifier si le serveur exige un JWT (mode web uniquement).
  // En mode Tauri, il n'y a pas de serveur HTTP → pas d'authentification.
  useEffect(() => {
    const checkAuth = async () => {
      if (isTauri()) {
        setAuthRequired(false);
        setAuthChecked(true);
        return;
      }
      try {
        const res = await apiFetch("/api/pty/sessions");
        if (res.status === 401) {
          clearAuth();
          setAuthRequired(true);
        } else {
          setAuthRequired(false);
        }
      } catch {
        setAuthRequired(true);
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  // Fetch System Statistics
  const fetchSystemStats = useCallback(async () => {
    try {
      if (isTauri()) {
        const data = await getSystemStatsWeb();
        // Liste des processus en parallèle (top CPU, logique Rust native)
        const processes = await listProcessesWeb();
        setSystemStats({ ...(data as unknown as SystemStats), processes } as SystemStats);
        return;
      }
      const res = await apiFetch("/api/system/stats");
      const data = await res.json();
      setSystemStats(data);
    } catch (e) {
      console.error("Failed to fetch system stats", e);
    }
  }, []);

  // Login : échange le token statique contre un JWT, puis recharge l'app
  const handleLogin = useCallback(async (staticToken: string) => {
    const result = await login(staticToken);
    setAuth(result.token, result.role);
    setUserRole(result.role);
    if (!result.authEnabled) {
      // Serveur sans AUTH_SECRET : pas de JWT requis, tout passe
      setAuthRequired(false);
    } else {
      setAuthRequired(false);
      setAuthChecked(true);
    }
    fetchSessions();
    fetchSystemStats();
  }, [fetchSessions, fetchSystemStats]);

  // Logout : révoque le JWT (blacklist serveur) et retourne à l'écran de connexion.
  // En mode Tauri, l'auth est désactivée → on ne ré-affiche pas AuthScreen.
  const handleLogout = useCallback(async () => {
    if (isTauri()) {
      // Pas de serveur : nettoyage local uniquement, l'app reste accessible
      clearAuth();
      setUserRole(null);
      setSessions([]);
      return;
    }
    await logout();
    setUserRole(null);
    setAuthRequired(true);
    setAuthChecked(true);
    setSessions([]);
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchSystemStats();

    const interval = setInterval(() => {
      fetchSystemStats();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchSessions, fetchSystemStats]);

  // Create new PTY Session (Tauri invoke ou API web)
  const createSession = useCallback(async (options: {
    name: string;
    cwd?: string;
    shell?: string;
    env?: Record<string, string>;
  }): Promise<TerminalSessionInfo | null> => {
    try {
      if (isTauri()) {
        const newSess = await createPtySessionWeb(options.name);
        return newSess;
      }
      const res = await apiFetch("/api/pty/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error("Failed to create session", e);
      return null;
    }
  }, []);

  // Create new PTY Session
  const handleCreateSession = async () => {
    const sessionCount = sessions.length + 1;
    const newSess = await createSession({ name: `Terminal #${sessionCount} - Bash` });
    if (newSess) {
      setSessions((prev) => [...prev, newSess]);
      setActiveSessionId(newSess.id);
      setActiveView("terminal");
    }
  };

  // Close PTY Session
  const handleCloseSession = useCallback(async (id: string) => {
    try {
      if (isTauri()) {
        await closePtySessionWeb(id);
        setSessions((prev) => {
          const updated = prev.filter((s) => s.id !== id);
          setActiveSessionId((currentActive) =>
            currentActive === id ? (updated.length > 0 ? updated[0].id : null) : currentActive
          );
          return updated;
        });
        return;
      }
      await apiFetch(`/api/pty/${id}`, { method: "DELETE" });
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
      const newSess = await createSession({ name: `Terminal Maintenance - Bash` });
      if (!newSess) return;
      targetId = newSess.id;
      setSessions((prev) => [...prev, newSess]);
      setActiveSessionId(targetId);
    }

    setActiveView("terminal");

    const cmdWithNewline = command.endsWith("\n") ? command : command + "\n";
    if (isTauri()) {
      tauriInvoke("write_pty_input", { sessionId: targetId, data: cmdWithNewline }).catch((e) => {
        console.error(`[PTY] Échec d'envoi de commande à la session ${targetId}`, errMsg(e));
      });
    } else {
      apiFetch(`/api/pty/${targetId}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: cmdWithNewline }),
      }).catch((e) => {
        console.error(`[PTY] Échec d'envoi de commande à la session ${targetId}`, errMsg(e));
      });
    }
  }, [activeSessionId, sessions, createSession]);

  // Launch terminal session with custom profile
  const handleLaunchProfile = useCallback(async (profile: ShellProfile) => {
    try {
      const newSess = await createSession({
        name: profile.name,
        cwd: profile.cwd,
        shell: profile.shell,
        env: profile.env,
      });
      if (!newSess) return;
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
  }, [handleExecuteInTerminal, createSession]);

  // Restore saved tab sessions
  const handleRestoreSavedTabs = useCallback(async (savedTabs: SavedTabSession[]) => {
    for (const tab of savedTabs) {
      try {
        const newSess = await createSession({
          name: tab.name,
          cwd: tab.cwd,
          shell: tab.shell,
        });
        if (!newSess) continue;
        setSessions((prev) => [...prev.filter((s) => s.id !== newSess.id), newSess]);
        setActiveSessionId(newSess.id);
      } catch (e) {
        console.error("Failed to restore tab session:", e);
      }
    }
    setActiveView("terminal");
  }, [createSession]);

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
      const newSess = await createSession({
        name: `SSH: ${host.name}`,
        shell: "bash",
        cwd: "~",
      });
      if (!newSess) return;
      setSessions((prev) => [...prev, newSess]);
      setActiveSessionId(newSess.id);
      setActiveView("terminal");

      setTimeout(() => {
        handleExecuteInTerminal(cmd, newSess.id);
      }, 600);
    } catch (e) {
      console.error("Failed to launch SSH session", e);
    }
  }, [handleExecuteInTerminal, createSession]);

  // Open File into Monaco Editor from Terminal Explorer
  const handleOpenMonacoFile = useCallback((filePath: string) => {
    setMonacoFilePath(filePath);
    setActiveView("monaco");
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const secondarySession = sessions.find((s) => s.id !== activeSessionId) || sessions[0];

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
      {/* Écran de connexion si le serveur exige un JWT */}
      {authChecked && authRequired && !isAuthenticated() && (
        <AuthScreen onLogin={handleLogin} />
      )}

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
          userRole={userRole}
          onLogout={handleLogout}
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
          <Suspense fallback={<ViewFallback label="Carnet SSH" />}>
            <LazySshHostManager
              onExecuteInTerminal={handleExecuteInTerminal}
              onLaunchSshSession={handleLaunchSshSession}
              sessions={sessions}
              activeSessionId={activeSessionId}
            />
          </Suspense>
        )}

        {activeView === "tunnels" && (
          <Suspense fallback={<ViewFallback label="Tunnels" />}>
            <LazySshTunnelManager
              onExecuteInTerminal={handleExecuteInTerminal}
              sessions={sessions}
              activeSessionId={activeSessionId}
            />
          </Suspense>
        )}

        {activeView === "profiles" && (
          <Suspense fallback={<ViewFallback label="Profils" />}>
            <LazyProfileManager
              onLaunchProfile={handleLaunchProfile}
              activeSessions={sessions}
              onRestoreSavedTabs={handleRestoreSavedTabs}
            />
          </Suspense>
        )}

        {activeView === "playbooks" && (
          <Suspense fallback={<ViewFallback label="Playbooks" />}>
            <LazyPlaybookSequencer
              sessions={sessions}
              activeSessionId={activeSessionId}
              onExecuteCommandInTerminal={handleExecuteInTerminal}
              onOpenTerminalView={() => setActiveView("terminal")}
            />
          </Suspense>
        )}

        {activeView === "maintenance" && (
          <Suspense fallback={<ViewFallback label="Maintenance" />}>
            <LazyMaintenanceHub
              sessions={sessions}
              activeSessionId={activeSessionId}
              onExecuteInTerminal={handleExecuteInTerminal}
            />
          </Suspense>
        )}

        {activeView === "monaco" && (
          <Suspense fallback={<ViewFallback label="Éditeur Monaco" />}>
            <LazyMonacoFileEditor
              onExecuteInTerminal={handleExecuteInTerminal}
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
            <LazySkillsHub onExecuteInTerminal={handleExecuteInTerminal} />
          </Suspense>
        )}

        {activeView === "snippets" && (
          <Suspense fallback={<ViewFallback label="Snippets" />}>
            <LazySnippetsLibrary onExecuteInTerminal={handleExecuteInTerminal} />
          </Suspense>
        )}

        {activeView === "bookmarks" && (
          <Suspense fallback={<ViewFallback label="Raccourcis Web" />}>
            <LazyWebShortcutsManager
              onExecuteInTerminal={handleExecuteInTerminal}
              sessions={sessions}
              activeSessionId={activeSessionId}
            />
          </Suspense>
        )}

        {activeView === "stats" && (
          <Suspense fallback={<ViewFallback label="Ressources" />}>
            <LazySystemMonitorModal stats={systemStats} onRefresh={fetchSystemStats} />
          </Suspense>
        )}
      </main>
    </div>
  );
}

