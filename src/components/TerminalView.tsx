import React, { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

import {
  Copy,
  Eraser,
  Search,
  ZoomIn,
  ZoomOut,
  Check,
  History,
  Send,
  ChevronDown,
  Trash2,
  Bell,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  RefreshCw,
  Upload,
  PanelLeft,
  ArrowRight,
  Play
} from "lucide-react";
import { TerminalSessionInfo, TerminalTheme, FileTreeItem } from "../types";
import { TERMINAL_THEMES } from "../constants/themes";
import { encryptValue, decryptValue } from "../hooks/useLocalStorage";
import { apiFetch, wsUrlWithToken } from "../lib/api";
import { isTauri, tauriInvoke, tauriListen, PtyOutputEvent } from "../lib/tauri";

interface TerminalViewProps {
  session: TerminalSessionInfo;
  activeThemeId: string;
  onThemeChange: (themeId: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  notificationsEnabled?: boolean;
  onOpenMonacoFile?: (filePath: string) => void;
}

const STORAGE_KEY_HISTORY = "tauri_linux_terminal_command_history";

export const TerminalView: React.FC<TerminalViewProps> = ({
  session,
  activeThemeId,
  onThemeChange,
  fontSize,
  setFontSize,
  notificationsEnabled = true,
  onOpenMonacoFile,
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
  const [explorerPath, setExplorerPath] = useState<string>(session.cwd || process.cwd());
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

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) {
        const decrypted = decryptValue(saved);
        setCommandHistory(JSON.parse(decrypted));
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
        localStorage.setItem(STORAGE_KEY_HISTORY, encryptValue(serialized));
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
        localStorage.setItem(STORAGE_KEY_HISTORY, encryptValue(serialized));
      } catch {}
      return updated;
    });
  };

  const clearHistory = () => {
    setCommandHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch {}
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

  // Fetch Synchronized File Explorer Tree
  const fetchExplorerTree = useCallback(async (targetDir?: string) => {
    setLoadingExplorer(true);
    try {
      const dirPath = targetDir || session.cwd || process.cwd();
      const url = `/api/fs/tree?path=${encodeURIComponent(dirPath)}`;
      const res = await apiFetch(url);
      const data = await res.json();
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
    setIsDraggingFile(false);
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
      const pathsOrNames = droppedFiles
        .map((f: File) => (f as any).path ? `"${(f as any).path}"` : `"${(f as File).name}"`)
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
        } catch {}
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
        tauriInvoke("write_pty_input", { sessionId: session.id, data }).catch(() => {});
      } else if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      } else {
        apiFetch(`/api/pty/${session.id}/write`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        }).catch(() => {});
      }
    };

    const sendResize = (cols: number, rows: number) => {
      if (tauriMode) {
        tauriInvoke("resize_pty_session", { sessionId: session.id, cols, rows }).catch(() => {});
      } else if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
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
        } catch (e: any) {
          setStatusText(`Erreur PTY Rust : ${e?.message || e}`);
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
            setIsConnected(false);
            setStatusText(`Processus terminé (code ${msg.code})`);
            triggerNotification(
              "🔴 Processus PTY Linux Terminé",
              `Session ${session.name} terminée avec le code de sortie ${msg.code}.`
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
        setStatusText("Déconnecté");
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
        } catch {}
      }, 50);
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
      onDataDisposable.dispose();
      resizeObserver.disconnect();
      if (tauriMode) {
        unlistenPty?.();
        tauriInvoke("close_pty_session", { sessionId: session.id }).catch(() => {});
      } else if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      try { webglAddon?.dispose(); } catch {}
      try { searchAddon.dispose(); } catch {}
      try { webLinksAddon.dispose(); } catch {}
      try { fitAddon.dispose(); } catch {}
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
      {/* Terminal Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/80 text-xs text-slate-300">
        {/* Left Status & Session Name */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="font-mono text-slate-200 font-medium text-xs">
            {session.name}
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
            {session.shell}
          </span>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Synchronized CWD Explorer Toggle */}
          <button
            onClick={() => setShowExplorer(!showExplorer)}
            className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors ${
              showExplorer
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
            title="Afficher/Masquer l'explorateur de fichiers synchronisé CWD"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Explorateur CWD</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded transition-colors ${
              showSearch
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Rechercher dans le terminal"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Copy Selection */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
            title="Copier la sélection (ou Ctrl+C)"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Send Interrupt Ctrl+C */}
          <button
            onClick={handleInterrupt}
            className="px-2 py-1 text-[11px] font-mono font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors"
            title="Envoyer SIGINT (Ctrl+C)"
          >
            Ctrl+C
          </button>

          {/* Clear Screen */}
          <button
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Effacer l'écran"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Font Size Adjusters */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-1">
            <button
              onClick={() => setFontSize(Math.max(10, fontSize - 1))}
              className="p-1 text-slate-400 hover:text-slate-200"
              title="Diminuer la police"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono px-1.5 text-slate-300">
              {fontSize}px
            </span>
            <button
              onClick={() => setFontSize(Math.min(24, fontSize + 1))}
              className="p-1 text-slate-400 hover:text-slate-200"
              title="Agrandir la police"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Theme Dropdown Selector */}
          <select
            value={activeThemeId}
            onChange={(e) => onThemeChange(e.target.value)}
            className="bg-slate-900 text-slate-300 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-emerald-500"
          >
            {TERMINAL_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Floating Search Bar */}
      {showSearch && (
        <form
          onSubmit={handleSearchNext}
          className="flex items-center gap-2 p-2 bg-slate-900 border-b border-slate-800 text-xs shadow-md z-10"
        >
          <Search className="w-4 h-4 text-emerald-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans l'historique terminal..."
            className="flex-1 bg-slate-950 text-slate-100 px-2.5 py-1 rounded border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono text-xs"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSearchPrev}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px]"
          >
            Précédent
          </button>
          <button
            type="submit"
            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded font-mono text-[11px]"
          >
            Suivant
          </button>
          <button
            type="button"
            onClick={() => setShowSearch(false)}
            className="px-2 py-1 text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </form>
      )}

      {/* Main Terminal Body with Optional Synchronized CWD File Explorer */}
      <div className="flex-1 w-full h-full flex overflow-hidden relative">
        {/* Synchronized CWD Explorer Side Drawer */}
        {showExplorer && (
          <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 z-10 text-xs text-slate-300 select-none">
            <div className="p-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5 font-mono text-[11px] uppercase">
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                Explorateur CWD
              </span>
              <button
                onClick={() => fetchExplorerTree(explorerPath)}
                className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingExplorer ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Path Indicator */}
            <div className="px-2.5 py-1.5 bg-slate-950 font-mono text-[10px] text-slate-400 border-b border-slate-800/80 flex items-center justify-between gap-1">
              <span className="truncate">{explorerPath}</span>
              {isTruncated && (
                <span className="shrink-0 text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded" title={`Dossier volumineux : 300 / ${totalItemsCount} éléments affichés`}>
                  300/{totalItemsCount}
                </span>
              )}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
              {explorerParent && explorerParent !== explorerPath && (
                <button
                  onClick={() => fetchExplorerTree(explorerParent)}
                  className="w-full text-left px-2 py-1.5 rounded text-[11px] text-emerald-400 hover:bg-slate-800 font-mono flex items-center gap-2"
                >
                  <Folder className="w-3.5 h-3.5" /> .. (Dossier parent)
                </button>
              )}

              {fileItems.map((item) => (
                <div
                  key={item.path}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.path);
                  }}
                  onClick={() => {
                    if (item.isDirectory) {
                      fetchExplorerTree(item.path);
                    }
                  }}
                  className={`group w-full px-2 py-1.5 rounded text-[11px] flex items-center justify-between transition-colors cursor-pointer ${
                    item.isDirectory
                      ? "hover:bg-amber-500/10 text-amber-200"
                      : "hover:bg-slate-800 text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    {item.isDirectory ? (
                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </div>

                  {/* Action Icons on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
                    {!item.isDirectory && onOpenMonacoFile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMonacoFile(item.path);
                        }}
                        className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded"
                        title="Éditer dans Monaco"
                      >
                        <FileCode className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendInputToPty(`"${item.path}" `);
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-slate-700 rounded"
                      title="Injecter le chemin dans le PTY"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {fileItems.length === 0 && !loadingExplorer && (
                <div className="p-3 text-center text-[10px] text-slate-500 font-mono">
                  Dossier vide
                </div>
              )}
            </div>
          </div>
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

      {/* Persistent Command Execution Bar & History Dropdown */}
      <div className="bg-slate-950 border-t border-slate-800/80 p-2 flex items-center gap-2 relative z-20">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-700/80 transition-colors"
            title="Historique des commandes sauvegardées (localStorage)"
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Historique</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Dropdown Menu */}
          {showHistoryDropdown && (
            <div className="absolute bottom-full left-0 mb-1 w-72 max-h-60 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden flex flex-col z-50">
              <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>COMMANDES RÉCENTES</span>
                <button
                  onClick={clearHistory}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1"
                  title="Effacer l'historique"
                >
                  <Trash2 className="w-3 h-3" />
                  Effacer
                </button>
              </div>

              <div className="overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                {commandHistory.length > 0 ? (
                  commandHistory.map((cmd, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setInputCommand(cmd);
                        handleExecuteInputCommand(cmd);
                      }}
                      className="px-2.5 py-1.5 rounded hover:bg-slate-800 text-xs font-mono text-emerald-300 cursor-pointer truncate flex items-center justify-between group"
                    >
                      <span className="truncate">{cmd}</span>
                      <Send className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-500 text-xs font-mono">
                    Aucune commande enregistrée
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Command Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecuteInputCommand();
          }}
          className="flex-1 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            placeholder="Saisissez ou choisissez une commande à envoyer au PTY... ($ apt update, df -h, etc.)"
            className="flex-1 bg-slate-900 text-slate-100 placeholder-slate-500 px-3 py-1.5 rounded text-xs font-mono border border-slate-800 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!inputCommand.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold text-xs font-mono rounded transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exécuter</span>
          </button>
        </form>
      </div>
    </div>
  );
};

