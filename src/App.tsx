import { useEffect, useState, useCallback, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { AppViews } from "./components/AppViews";
import { CommandPalette } from "./components/CommandPalette";
import { TerminalSessionInfo, SystemStats, ShellProfile, SavedTabSession, SshHost, CommandSnippet, Playbook } from "./types";
import { useSecureStorage } from "./hooks/useSecureStorage";
import {
  apiFetch,
  clearAuth,
  getRole,
  isAuthenticated,
  login,
  logout,
  setAuth,
} from "./lib/api";
import { errMsg } from "./lib/errors";
import { AuthScreen } from "./components/AuthScreen";

/** Onglets sauvegardés localement (noms/cwd/shells — non sensibles). */
const SAVED_TABS_KEY = "terminal.savedTabs";
import {
  closePtySessionWeb,
  createPtySessionWeb,
  getSystemStatsWeb,
  listProcessesWeb,
  isTauri,
  listPtySessionsWeb,
  tauriInvoke,
} from "./lib/tauri";

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

  // Snippets & playbooks pour la recherche globale de la palette (mêmes
  // clés que SnippetsLibrary / PlaybookSequencer — rechargés à chaque
  // ouverture de la palette via le montage conditionnel).
  const { value: paletteSnippets } = useSecureStorage<CommandSnippet[]>(
    "terminal_custom_snippets",
    []
  );
  const { value: palettePlaybooks } = useSecureStorage<Playbook[]>(
    "tauri_linux_playbooks",
    []
  );
  const bootRestoreDone = useRef(false);
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
  const handleRequestNotifications = useCallback(() => {
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
  }, [notificationsEnabled]);


  // Fetch PTY sessions list from server
  const fetchSessions = useCallback(async () => {
    try {
      if (isTauri()) {
        const tauriSessions = await listPtySessionsWeb();
        setSessions(tauriSessions);
        if (tauriSessions.length > 0 && !activeSessionId) {
          setActiveSessionId(tauriSessions[0].id);
        }
        if (tauriSessions.length === 0 && !bootRestoreDone.current) {
          bootRestoreDone.current = true;
          restoreSavedTabs();
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
        // Aucune session côté serveur (redémarrage) → restaurer les
        // onglets sauvegardés localement (noms, cwd, shells).
        if (data.sessions.length === 0 && !bootRestoreDone.current) {
          bootRestoreDone.current = true;
          restoreSavedTabs();
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
    setAuth(result.token, result.role, result.refreshToken);
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

    // Polling des stats : 4s, PAUSÉ quand l'onglet/la fenêtre est caché
    // (pas de gaspillage CPU / lectures /proc en arrière-plan).
    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        fetchSystemStats();
      }, 4000);
    };
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchSystemStats(); // refresh immédiat au retour
        startPolling();
      } else {
        stopPolling();
      }
    };
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchSessions, fetchSystemStats]);

  // ── Bus de sortie PTY : TerminalView expose la sortie brute, et les
  //    consommateurs (séquenceur de playbooks) s'y abonnent pour détecter
  //    les codes de sortie réels des commandes exécutées. ──
  const outputListenersRef = useRef<Set<(data: string) => void>>(new Set());
  const subscribeTerminalOutput = useCallback((fn: (data: string) => void) => {
    outputListenersRef.current.add(fn);
    return () => {
      outputListenersRef.current.delete(fn);
    };
  }, []);
  const handleTerminalOutput = useCallback((data: string) => {
    outputListenersRef.current.forEach((fn) => fn(data));
  }, []);

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

  // Keyboard shortcut listener
  //   Ctrl+Shift+P : basculer la palette de commandes
  //   Ctrl+Shift+T : nouveau terminal
  //   Ctrl+Shift+F : plein écran
  // (placé après handleCreateSession : il en dépend)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === "P" || e.key === "p") {
          e.preventDefault();
          setIsCommandPaletteOpen((prev) => !prev);
        } else if (e.key === "T" || e.key === "t") {
          e.preventDefault();
          void handleCreateSession();
        } else if (e.key === "F" || e.key === "f") {
          e.preventDefault();
          setIsFullscreen((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateSession]);

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

  /**
   * Restaure les onglets sauvegardés localement (après un redémarrage du
   * serveur/desktop : les processus PTY sont morts, on recrée les onglets
   * avec leurs noms, cwd et shells). Non sensible → localStorage.
   */
  const restoreSavedTabs = useCallback(() => {
    try {
      const raw = localStorage.getItem(SAVED_TABS_KEY);
      if (!raw) return;
      const tabs = JSON.parse(raw) as SavedTabSession[];
      if (Array.isArray(tabs) && tabs.length > 0) {
        handleRestoreSavedTabs(tabs);
      }
    } catch (e) {
      console.warn("[App] Onglets sauvegardés invalides, restauration ignorée", e);
    }
  }, [handleRestoreSavedTabs]);

  // Sauvegarde automatique des onglets (noms, cwd, shells) à chaque
  // changement de sessions — limite 8 onglets, localStorage clair
  // documenté (données non sensibles).
  useEffect(() => {
    if (sessions.length === 0) return;
    const tabs: SavedTabSession[] = sessions.slice(0, 8).map((s) => ({
      id: s.id,
      name: s.name,
      cwd: s.cwd,
      shell: s.shell,
    }));
    try {
      localStorage.setItem(SAVED_TABS_KEY, JSON.stringify(tabs));
    } catch {
      // Stockage indisponible (mode privé) — silencieux par design
    }
  }, [sessions]);

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
        snippets={paletteSnippets}
        playbooks={palettePlaybooks}
        onExecuteInTerminal={handleExecuteInTerminal}
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
        <AppViews
          activeView={activeView}
          sessions={sessions}
          activeSessionId={activeSessionId}
          activeSession={activeSession}
          secondarySession={secondarySession}
          splitMode={splitMode}
          isFullscreen={isFullscreen}
          notificationsEnabled={notificationsEnabled}
          fontSize={fontSize}
          activeThemeId={activeThemeId}
          monacoFilePath={monacoFilePath}
          systemStats={systemStats}
          onSelectSession={setActiveSessionId}
          onCreateSession={handleCreateSession}
          onCloseSession={handleCloseSession}
          onRefreshSessions={fetchSessions}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onRequestNotifications={handleRequestNotifications}
          onThemeChange={setActiveThemeId}
          setFontSize={setFontSize}
          onSetSplitMode={setSplitMode}
          onOpenMonacoFile={handleOpenMonacoFile}
          onTerminalOutput={handleTerminalOutput}
          onExecuteInTerminal={handleExecuteInTerminal}
          onLaunchSshSession={handleLaunchSshSession}
          onLaunchProfile={handleLaunchProfile}
          onRestoreSavedTabs={handleRestoreSavedTabs}
          onOpenTerminalView={() => setActiveView("terminal")}
          subscribeOutput={subscribeTerminalOutput}
          onRefreshStats={fetchSystemStats}
        />
      </main>
    </div>
  );
}

