import React, { useEffect, useRef, useState, useCallback, memo } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

import { Upload } from "lucide-react";
import { TerminalSessionInfo, FileTreeItem } from "../types";
import { TERMINAL_THEMES } from "../constants/themes";
import { TerminalExplorer } from "./TerminalExplorer";
import { TerminalToolbar } from "./TerminalToolbar";
import { TerminalCommandBar } from "./TerminalCommandBar";
import { apiFetch, wsUrlWithToken } from "../lib/api";
import { errMsg } from "../lib/errors";
import { fsTree } from "../lib/fsApi";
import { isTauri, tauriInvoke, tauriListen, PtyOutputEvent } from "../lib/tauri";
interface TerminalViewProps {
  session: TerminalSessionInfo;
  activeThemeId: string;
  onThemeChange: (themeId: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  notificationsEnabled?: boolean;
  onOpenMonacoFile?: (filePath: string) => void;
  /** Observateur de la sortie PTY (utilisé par le séquenceur de playbooks
   *  pour détecter les codes de sortie réels des commandes). */
  onOutput?: (data: string) => void;
}

const STORAGE_KEY_HISTORY = "tauri_linux_terminal_command_history";

const TerminalViewInner: React.FC<TerminalViewProps> = ({
  session,
  activeThemeId,
  onThemeChange,
  fontSize,
  setFontSize,
  notificationsEnabled = true,
  onOpenMonacoFile,
  onOutput,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Connexion...");

  // Synchronized File Explorer Side Drawer
  const [showExplorer, setShowExplorer] = useState<boolean>(false);
  const [explorerPath, setExplorerPath] = useState<string>(session.cwd || (typeof process !== "undefined" ? process.cwd() : "/"));
  const [explorerParent, setExplorerParent] = useState<string>("");
  const [fileItems, setFileItems] = useState<FileTreeItem[]>([]);
  const [loadingExplorer, setLoadingExplorer] = useState<boolean>(false);
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const [totalItemsCount, setTotalItemsCount] = useState<number>(0);

  // Drag and Drop state
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Command input bar & history dropdown state
  const [inputCommand, setInputCommand] = useState<string>("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState<boolean>(false);

  // Process timing tracker for long-running process notifications
  const lastInputTimeRef = useRef<number>(0);
  const activeCommandRef = useRef<string>("");
  const lineBufferRef = useRef<string>("");

  const currentTheme =
    TERMINAL_THEMES.find((t) => t.id === activeThemeId) || TERMINAL_THEMES[0];

  // Load history from localStorage on mount (historique non sensible — clair)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) {
        setCommandHistory(JSON.parse(saved));
      } else {
        const defaultHistory = [
          "apt update && apt upgrade -y",
          "systemctl status nginx",
          "htop",
          "df -h",
          "journalctl -xe --no-pager -n 50",
          "du -sh /var/log/*",
          "free -m",
          "uname -a"
        ];
        setCommandHistory(defaultHistory);
        const serialized = JSON.stringify(defaultHistory);
        localStorage.setItem(STORAGE_KEY_HISTORY, serialized);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const saveCommandToHistory = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setCommandHistory((prev) => {
      const filtered = prev.filter((c) => c !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, 50); // Keep max 50 items
      try {
        const serialized = JSON.stringify(updated);
        localStorage.setItem(STORAGE_KEY_HISTORY, serialized);
      } catch {
        // Stockage indisponible (mode privé) — l'historique reste en mémoire
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setCommandHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch {
      // Stockage indisponible (mode privé) — rien à nettoyer
    }
  };

  const triggerNotification = (title: string, body: string) => {
    if (!notificationsEnabled) return;
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/assets/favicon.ico",
      });
    }
  };

  // Fetch Synchronized File Explorer Tree (fsApi unifié : Rust en Tauri,
  // /api/fs/tree en web — mêmes règles de sécurité)
  const fetchExplorerTree = useCallback(async (targetDir?: string) => {
    setLoadingExplorer(true);
    try {
      const dirPath = targetDir || session.cwd || (typeof process !== "undefined" ? process.cwd() : "/");
      const data = await fsTree(dirPath);
      if (data.items) {
        setFileItems(data.items);
        setExplorerPath(data.currentPath);
        setExplorerParent(data.parentPath);
        setIsTruncated(!!data.truncated);
        setTotalItemsCount(data.totalCount || data.items.length);
      }
    } catch (e) {
      console.error("Failed to load CWD explorer tree", e);
    } finally {
      setLoadingExplorer(false);
    }
  }, [session.cwd]);

  useEffect(() => {
    if (showExplorer) {
      fetchExplorerTree(session.cwd);
    }
  }, [showExplorer, session.cwd, fetchExplorerTree]);

  // Inject text directly into terminal input stream
  const sendInputToPty = (text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "input", data: text }));
      if (xtermRef.current) xtermRef.current.focus();
    } else {
      setInputCommand((prev) => prev + text);
    }
  };

  // Handle Drag Over & Drop onto Terminal Canvas
  const handleDragOverTerminal = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDraggingFile) setIsDraggingFile(true);
  };

  const handleDragLeaveTerminal = (e: React.DragEvent) => {
    e.preventDefault();
    // dragleave se déclenche aussi quand le curseur passe sur un élément
    // ENFANT du conteneur → ne masquer l'overlay que si on quitte vraiment.
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setIsDraggingFile(false);
    }
  };

  const handleDropTerminal = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    // 1. Check if dropped item comes from our file explorer
    const internalPath = e.dataTransfer.getData("text/plain");
    if (internalPath) {
      sendInputToPty(`"${internalPath}" `);
      return;
    }

    // 2. Check native external files dropped from desktop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      // En Tauri, File expose `.path` (propriété non standard) ; sinon nom seul
      const pathsOrNames = droppedFiles
        .map((f: File) => {
          const withPath = f as File & { path?: string };
          return withPath.path ? `"${withPath.path}"` : `"${f.name}"`;
        })
        .join(" ");
      sendInputToPty(`${pathsOrNames} `);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize xterm.js instance
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Cascadia Code', 'Consolas', monospace",
      lineHeight: 1.2,
      theme: {
        background: currentTheme.background,
        foreground: currentTheme.foreground,
        cursor: currentTheme.cursor,
        cursorAccent: currentTheme.cursorAccent,
        selectionBackground: currentTheme.selectionBackground,
        black: currentTheme.black,
        red: currentTheme.red,
        green: currentTheme.green,
        yellow: currentTheme.yellow,
        blue: currentTheme.blue,
        magenta: currentTheme.magenta,
        cyan: currentTheme.cyan,
        white: currentTheme.white,
        brightBlack: currentTheme.brightBlack,
        brightRed: currentTheme.brightRed,
        brightGreen: currentTheme.brightGreen,
        brightYellow: currentTheme.brightYellow,
        brightBlue: currentTheme.brightBlue,
        brightMagenta: currentTheme.brightMagenta,
        brightCyan: currentTheme.brightCyan,
        brightWhite: currentTheme.brightWhite,
      },
      allowTransparency: true,
      rows: 24,
      cols: 80,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    let webglAddon: WebglAddon | null = null;
    try {
      webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        try {
          webglAddon?.dispose();
        } catch {
          // Addon déjà disposé lors de la perte de contexte WebGL
        }
        webglAddon = null;
      });
      term.loadAddon(webglAddon);
    } catch {
      // Automatic fallback to DOM / Canvas renderer
      webglAddon = null;
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // ── Connexion PTY : mode Tauri (invoke Rust) ou WebSocket (fallback web) ──
    const tauriMode = isTauri();
    let unlistenPty: (() => void) | null = null;
    let ws: WebSocket | null = null;

    const handlePtyOutput = (data: string) => {
      term.write(data);
      lineBufferRef.current += data;
      onOutput?.(data);

      // Check for process finish or long execution trigger
      const elapsedSec = (Date.now() - lastInputTimeRef.current) / 1000;
      if (elapsedSec > 4 && activeCommandRef.current) {
        triggerNotification(
          "⚙️ PTY Linux - Exécution Terminée",
          `La commande "${activeCommandRef.current.slice(0, 40)}" s'est terminée (${elapsedSec.toFixed(1)}s).`
        );
        activeCommandRef.current = "";
      }
    };

    const sendInput = (data: string) => {
      if (tauriMode) {
        tauriInvoke("write_pty_input", { sessionId: session.id, data }).catch((e) => {
          console.error(`[PTY] Échec d'écriture session ${session.id}`, errMsg(e));
          setStatusText("⚠️ Échec d'écriture PTY");
        });
      } else if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      } else {
        apiFetch(`/api/pty/${session.id}/write`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        }).catch((e) => {
          console.error(`[PTY] Échec d'écriture session ${session.id}`, errMsg(e));
          setStatusText("⚠️ Échec d'écriture PTY");
        });
      }
    };

    const sendResize = (cols: number, rows: number) => {
      if (tauriMode) {
        tauriInvoke("resize_pty_session", { sessionId: session.id, cols, rows }).catch((e) => {
          console.error(`[PTY] Échec resize session ${session.id}`, errMsg(e));
        });
      } else if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    };

    // Reconnexion auto (mode web) : backoff progressif 1s → 2s → 4s → 8s
    // → 10s max. Arrêtée si le processus a terminé (exit) ou si le
    // composant est démonté.
    let disposed = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let processExited = false;

    const scheduleReconnect = () => {
      if (disposed || processExited || tauriMode) return;
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 10_000);
      reconnectAttempts += 1;
      setStatusText(`Déconnecté — reconnexion dans ${Math.round(delay / 1000)}s`);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = async () => {
      if (tauriMode) {
        // Mode desktop : le PTY vit dans le processus Rust
        try {
          const dims = fitAddon.proposeDimensions();
          await tauriInvoke("create_pty_session", {
            sessionId: session.id,
            cols: dims?.cols || 80,
            rows: dims?.rows || 24,
          });
          unlistenPty = await tauriListen<PtyOutputEvent>("pty-output", (payload) => {
            if (payload.session_id === session.id) {
              handlePtyOutput(payload.data);
            }
          });
          setIsConnected(true);
          setStatusText("Connecté au PTY Rust (Tauri)");
          if (dims) sendResize(dims.cols, dims.rows);
        } catch (e) {
          setStatusText(`Erreur PTY Rust : ${errMsg(e)}`);
          setIsConnected(false);
        }
        return;
      }

      // Mode web : WebSocket vers le backend Node
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = wsUrlWithToken(`${protocol}//${window.location.host}/ws/pty?id=${session.id}`);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts = 0; // connexion rétablie → backoff remis à zéro
        setIsConnected(true);
        setStatusText("Connecté au PTY Linux");
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          ws!.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "output") {
            handlePtyOutput(msg.data);
          } else if (msg.type === "exit") {
            processExited = true; // ne pas reconnecter un processus terminé
            setIsConnected(false);
            setStatusText(`Processus terminé (code ${msg.code ?? "signal"})`);
            // Fermer la socket : le serveur a terminé la session (évite une
            // connexion zombie côté client).
            ws.close();
            triggerNotification(
              "🔴 Processus PTY Linux Terminé",
              `Session ${session.name} terminée avec le code de sortie ${msg.code ?? "signal"}.`
            );
          }
        } catch {
          handlePtyOutput(event.data);
        }
      };

      ws.onerror = () => {
        setStatusText("Erreur de websocket. Tentative HTTP...");
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!processExited) {
          setStatusText("Déconnecté");
          scheduleReconnect();
        }
      };
    };
    connect();

    // User keyboard input => PTY stdin (Tauri invoke ou WebSocket)
    let currentInputString = "";
    const onDataDisposable = term.onData((data) => {
      // Collect enter presses to save history
      if (data === "\r" || data === "\n") {
        if (currentInputString.trim()) {
          saveCommandToHistory(currentInputString);
          activeCommandRef.current = currentInputString;
          lastInputTimeRef.current = Date.now();
          currentInputString = "";
        }
      } else if (data === "\x7f") {
        currentInputString = currentInputString.slice(0, -1);
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        currentInputString += data;
      }

      sendInput(data);
    });

    // Debounced ResizeObserver (50ms) to reduce excessive IPC resize calls
    let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
      resizeDebounceTimer = setTimeout(() => {
        try {
          fitAddon.fit();
          const dims = fitAddon.proposeDimensions();
          if (dims) sendResize(dims.cols, dims.rows);
        } catch {
          // Terminal pas encore attaché au DOM — resize ignoré
        }
      }, 50);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
      onDataDisposable.dispose();
      resizeObserver.disconnect();
      if (tauriMode) {
        unlistenPty?.();
        tauriInvoke("close_pty_session", { sessionId: session.id }).catch((e) => {
          console.error(`[PTY] Échec fermeture session ${session.id}`, errMsg(e));
        });
      } else if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      // Dispose des addons : silencieux par design (déjà fermés/déconnectés)
      try { webglAddon?.dispose(); } catch { /* addon déjà disposé */ }
      try { searchAddon.dispose(); } catch { /* addon déjà disposé */ }
      try { webLinksAddon.dispose(); } catch { /* addon déjà disposé */ }
      try { fitAddon.dispose(); } catch { /* addon déjà disposé */ }
      term.dispose();
      xtermRef.current = null;
    };
  }, [session.id]);

  // Handle Theme Updates
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = {
        background: currentTheme.background,
        foreground: currentTheme.foreground,
        cursor: currentTheme.cursor,
        cursorAccent: currentTheme.cursorAccent,
        selectionBackground: currentTheme.selectionBackground,
        black: currentTheme.black,
        red: currentTheme.red,
        green: currentTheme.green,
        yellow: currentTheme.yellow,
        blue: currentTheme.blue,
        magenta: currentTheme.magenta,
        cyan: currentTheme.cyan,
        white: currentTheme.white,
        brightBlack: currentTheme.brightBlack,
        brightRed: currentTheme.brightRed,
        brightGreen: currentTheme.brightGreen,
        brightYellow: currentTheme.brightYellow,
        brightBlue: currentTheme.brightBlue,
        brightMagenta: currentTheme.brightMagenta,
        brightCyan: currentTheme.brightCyan,
        brightWhite: currentTheme.brightWhite,
      };
    }
  }, [activeThemeId, currentTheme]);

  // Handle Font Size Changes
  useEffect(() => {
    if (xtermRef.current && fitAddonRef.current) {
      xtermRef.current.options.fontSize = fontSize;
      fitAddonRef.current.fit();
    }
  }, [fontSize]);

  // Send input from Quick Command Bar
  const handleExecuteInputCommand = (cmdToSend?: string) => {
    const targetCmd = cmdToSend !== undefined ? cmdToSend : inputCommand;
    if (!targetCmd.trim()) return;

    saveCommandToHistory(targetCmd);
    activeCommandRef.current = targetCmd;
    lastInputTimeRef.current = Date.now();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "input", data: targetCmd + "\r" }));
    }

    setInputCommand("");
    setShowHistoryDropdown(false);

    if (xtermRef.current) {
      xtermRef.current.focus();
    }
  };

  // Search Action
  const handleSearchNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findNext(searchQuery);
    }
  };

  const handleSearchPrev = () => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findPrevious(searchQuery);
    }
  };

  // Clear Screen
  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  // Copy Selection
  const handleCopy = async () => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection();
      if (selection) {
        await navigator.clipboard.writeText(selection);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  // Send Interrupt Signal (Ctrl+C)
  const handleInterrupt = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "input", data: "\x03" }));
    }
  };

  return (
    <div
      className="flex flex-col h-full w-full select-none"
      style={{ backgroundColor: currentTheme.background }}
    >
      <TerminalToolbar
              statusText={statusText}
        session={session}
        isConnected={isConnected}
        showExplorer={showExplorer}
        setShowExplorer={setShowExplorer}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearchNext={handleSearchNext}
        handleSearchPrev={handleSearchPrev}
        handleCopy={handleCopy}
        copied={copied}
        handleInterrupt={handleInterrupt}
        handleClear={handleClear}
        fontSize={fontSize}
        setFontSize={setFontSize}
        activeThemeId={activeThemeId}
        onThemeChange={onThemeChange}
      />

      {/* Main Terminal Body with Optional Synchronized CWD File Explorer */}
      <div className="flex-1 w-full h-full flex overflow-hidden relative">
        {/* Synchronized CWD Explorer Side Drawer */}
        {showExplorer && (
          <TerminalExplorer
            explorerPath={explorerPath}
            explorerParent={explorerParent}
            fileItems={fileItems}
            loadingExplorer={loadingExplorer}
            isTruncated={isTruncated}
            totalItemsCount={totalItemsCount}
            onNavigate={(dir) => fetchExplorerTree(dir)}
            onRefresh={() => fetchExplorerTree(explorerPath)}
            onOpenMonacoFile={onOpenMonacoFile}
            onInjectPath={(p) => sendInputToPty(p)}
          />
        )}

        {/* Terminal Render Container with Drag-and-Drop Overlay */}
        <div
          onDragOver={handleDragOverTerminal}
          onDragLeave={handleDragLeaveTerminal}
          onDrop={handleDropTerminal}
          className="flex-1 w-full h-full p-2 overflow-hidden relative"
        >
          {/* Drag Overlay */}
          {isDraggingFile && (
            <div className="absolute inset-0 z-50 bg-emerald-950/85 border-2 border-dashed border-emerald-400 backdrop-blur-sm flex flex-col items-center justify-center text-emerald-300 font-mono pointer-events-none p-6 text-center">
              <Upload className="w-10 h-10 mb-2 animate-bounce text-emerald-400" />
              <p className="text-sm font-bold mb-1">Déposez le fichier ici</p>
              <p className="text-xs text-emerald-400/80">
                Son chemin absolu sera injecté dans l'invite de commande du terminal PTY Linux
              </p>
            </div>
          )}

          <div ref={containerRef} className="w-full h-full" />
        </div>
      </div>

      <TerminalCommandBar
        inputCommand={inputCommand}
        setInputCommand={setInputCommand}
        handleExecuteInputCommand={handleExecuteInputCommand}
        commandHistory={commandHistory}
        showHistoryDropdown={showHistoryDropdown}
        setShowHistoryDropdown={setShowHistoryDropdown}
        clearHistory={clearHistory}
      />
    </div>
  );
};

export const TerminalView = memo(TerminalViewInner);
