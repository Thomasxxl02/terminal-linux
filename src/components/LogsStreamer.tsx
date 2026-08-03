import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Play,
  Pause,
  Trash2,
  FileText,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  ArrowDown,
  RefreshCw,
  Terminal as TerminalIcon
} from "lucide-react";

interface LogLine {
  id: string;
  timestamp?: string;
  level: "info" | "warn" | "error" | "success" | "unknown";
  message: string;
  raw: string;
}

const PRESET_FILES = [
  { label: "Journal d'Application (Simulé)", path: "/tmp/application.log" },
  { label: "Système Général (Syslog)", path: "/var/log/syslog" },
  { label: "Dpkg Installation", path: "/var/log/dpkg.log" },
  { label: "Nginx Accès", path: "/var/log/nginx/access.log" },
  { label: "Nginx Erreurs", path: "/var/log/nginx/error.log" },
];

export const LogsStreamer: React.FC = () => {
  const [logPath, setLogPath] = useState<string>("/tmp/application.log");
  const [lines, setLines] = useState<LogLine[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [filterText, setFilterText] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"all" | "info" | "warn" | "error" | "success">("all");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineIdCounterRef = useRef<number>(0);

  // Parse raw log lines into structured data with high accuracy
  const parseLogLine = (rawLine: string): LogLine => {
    const trimmed = rawLine.trim();
    lineIdCounterRef.current += 1;
    const id = `log-line-${lineIdCounterRef.current}-${Date.now()}`;

    if (!trimmed) {
      return { id, level: "unknown", message: rawLine, raw: rawLine };
    }

    // Detect level
    let level: LogLine["level"] = "unknown";
    const upper = trimmed.toUpperCase();

    if (upper.includes("[ERROR]") || upper.includes("ERROR") || upper.includes("FATAL") || upper.includes("FAIL")) {
      level = "error";
    } else if (upper.includes("[WARN]") || upper.includes("WARN") || upper.includes("WARNING")) {
      level = "warn";
    } else if (upper.includes("[SUCCESS]") || upper.includes("SUCCESS") || upper.includes(" OK ") || upper.includes("OK:")) {
      level = "success";
    } else if (upper.includes("[INFO]") || upper.includes("INFO") || upper.includes("DEBUG") || upper.includes("TRACE")) {
      level = "info";
    }

    // Try to extract timestamp (e.g. "[2026-08-03 14:15:22]" or "Aug  3 14:15:22")
    let timestamp: string | undefined;
    const tsMatch = trimmed.match(/^\[([\d-:\s]+)\]/) || trimmed.match(/^(\w{3}\s+\d+\s+[\d:]+)/);
    if (tsMatch) {
      timestamp = tsMatch[1];
    }

    return {
      id,
      timestamp,
      level,
      message: trimmed,
      raw: rawLine
    };
  };

  const connectWebSocket = () => {
    // Clean old socket
    if (wsRef.current) {
      wsRef.current.close();
    }

    setErrorMsg(null);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/logs?path=${encodeURIComponent(logPath)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setLines([]);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "history" || payload.type === "log") {
            const rawText = payload.data || "";
            const rawLines = rawText.split("\n");
            
            // Remove the last empty line if it is just a trailing newline
            if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
              rawLines.pop();
            }

            const parsed = rawLines.map((l: string) => parseLogLine(l));
            
            setLines((prev) => {
              if (isPaused) return prev;
              const combined = [...prev, ...parsed];
              // Cap history at 2000 lines for solid client-side performance
              return combined.slice(-2000);
            });
          } else if (payload.type === "truncated") {
            setLines((prev) => [
              ...prev,
              {
                id: `trunc-${Date.now()}`,
                level: "warn",
                message: "--- Fichier journal tronqué par le serveur (Rotation) ---",
                raw: "--- Fichier journal tronqué par le serveur (Rotation) ---"
              }
            ]);
          } else if (payload.type === "error") {
            setErrorMsg(payload.message || "Erreur de streaming sur le serveur.");
          }
        } catch (e) {
          console.error("Failed to parse log frame", e);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error on logs streamer", err);
        setErrorMsg("Connexion interrompue ou fichier inaccessible.");
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
      };
    } catch (e: any) {
      setErrorMsg(e.message || "Impossible de démarrer la connexion.");
    }
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [logPath]);

  // Handle Pause toggle
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Clear current log lines list
  const clearLogs = () => {
    setLines([]);
  };

  // Perform auto-scroll to bottom of the viewport
  useEffect(() => {
    if (autoScroll && containerRef.current && !isPaused) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll, isPaused]);

  // Filter and search lines
  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      // 1. Level tab filter
      if (activeTab !== "all" && line.level !== activeTab) {
        return false;
      }
      
      // 2. Text input filter (case insensitive)
      if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        return line.raw.toLowerCase().includes(lowerFilter);
      }
      
      return true;
    });
  }, [lines, activeTab, filterText]);

  // Compute count by level
  const stats = useMemo(() => {
    const counts = { info: 0, warn: 0, error: 0, success: 0, total: lines.length };
    lines.forEach((l) => {
      if (l.level === "info") counts.info++;
      if (l.level === "warn") counts.warn++;
      if (l.level === "error") counts.error++;
      if (l.level === "success") counts.success++;
    });
    return counts;
  }, [lines]);

  // Helper to colorize keywords and search terms
  const highlightMessage = (line: LogLine) => {
    const text = line.raw;
    if (!searchText) {
      // Return standard colored segments
      return colorizeLogParts(text, line.level);
    }

    const index = text.toLowerCase().indexOf(searchText.toLowerCase());
    if (index === -1) {
      return colorizeLogParts(text, line.level);
    }

    // Highlight searched text
    const before = text.slice(0, index);
    const match = text.slice(index, index + searchText.length);
    const after = text.slice(index + searchText.length);

    return (
      <>
        {colorizeLogParts(before, line.level)}
        <mark className="bg-amber-400 text-slate-950 font-bold px-0.5 rounded">{match}</mark>
        {colorizeLogParts(after, line.level)}
      </>
    );
  };

  const colorizeLogParts = (text: string, level: LogLine["level"]) => {
    // Regexes to extract common log patterns: Timestamps, HTTP methods, status codes, IPs
    const ipPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
    const httpMethods = /\b(GET|POST|PUT|DELETE|OPTIONS|HEAD|PATCH)\b/g;
    
    // Quick parse: if it matches IPs or Methods, highlight them beautifully
    let rendered: React.ReactNode = text;
    
    if (level === "error") {
      return <span className="text-red-400 font-medium">{text}</span>;
    } else if (level === "warn") {
      return <span className="text-amber-400 font-medium">{text}</span>;
    } else if (level === "success") {
      return <span className="text-emerald-400 font-medium">{text}</span>;
    } else if (level === "info") {
      // Highlight INFO keyword differently
      if (text.includes("[INFO]")) {
        const parts = text.split("[INFO]");
        return (
          <span className="text-slate-300">
            {parts[0]}
            <span className="text-cyan-400 font-bold">[INFO]</span>
            {parts.slice(1).join("[INFO]")}
          </span>
        );
      }
      return <span className="text-slate-300">{text}</span>;
    }
    
    return <span className="text-slate-400">{text}</span>;
  };

  return (
    <div id="logs-streamer-root" className="flex flex-col h-full bg-[#030712] text-slate-100 font-sans">
      {/* Top Banner Toolbar */}
      <div id="logs-header-bar" className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-4 border-b border-slate-800 bg-[#0b0f19]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Visualiseur de Flux de Logs
              <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                tail -f
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Surveillance asynchrone et coloration syntaxique des logs système locaux
            </p>
          </div>
        </div>

        {/* Path Picker & Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Preset Logs Dropdown */}
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex-1 sm:flex-initial">
            <select
              value={logPath}
              onChange={(e) => setLogPath(e.target.value)}
              className="bg-transparent text-xs text-slate-200 px-3 py-2 font-mono focus:outline-none cursor-pointer w-full"
            >
              {PRESET_FILES.map((preset) => (
                <option key={preset.path} value={preset.path} className="bg-slate-950 text-slate-200">
                  {preset.label}
                </option>
              ))}
              <option value="" disabled className="bg-slate-950 text-slate-500">
                --- Saisir manuellement ---
              </option>
            </select>
          </div>

          {/* Custom path input */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <input
              type="text"
              value={logPath}
              onChange={(e) => setLogPath(e.target.value)}
              placeholder="Fichier personnalisé..."
              className="bg-slate-950 text-xs font-mono text-emerald-400 placeholder-slate-600 px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500 w-full sm:w-56"
            />
            <button
              onClick={connectWebSocket}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 transition-all flex items-center gap-1"
              title="Rebrancher le flux"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Counter & Level Filter Buttons */}
      <div id="logs-stats-bar" className="flex flex-wrap items-center gap-2 p-3 bg-[#080c14]/60 border-b border-slate-800 text-xs">
        <span className="text-slate-400 font-mono text-[11px] mr-2">Filtres :</span>
        
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === "all"
              ? "bg-slate-800 text-slate-100 border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Tout ({stats.total})
        </button>

        <button
          onClick={() => setActiveTab("success")}
          className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
            activeTab === "success"
              ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
              : "text-slate-400 hover:text-emerald-400/80"
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          Succès ({stats.success})
        </button>

        <button
          onClick={() => setActiveTab("info")}
          className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
            activeTab === "info"
              ? "bg-cyan-950 text-cyan-300 border border-cyan-500/30"
              : "text-slate-400 hover:text-cyan-400/80"
          }`}
        >
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          Infos ({stats.info})
        </button>

        <button
          onClick={() => setActiveTab("warn")}
          className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
            activeTab === "warn"
              ? "bg-amber-950 text-amber-300 border border-amber-500/30"
              : "text-slate-400 hover:text-amber-400/80"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Alertes ({stats.warn})
        </button>

        <button
          onClick={() => setActiveTab("error")}
          className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
            activeTab === "error"
              ? "bg-red-950 text-red-300 border border-red-500/30"
              : "text-slate-400 hover:text-red-400/80"
          }`}
        >
          <XCircle className="w-3.5 h-3.5 text-red-400" />
          Erreurs ({stats.error})
        </button>
      </div>

      {/* Interactive Logs Filtering Toolbar */}
      <div id="logs-filters-bar" className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-[#080c14] border-b border-slate-800">
        {/* Live Filter Query */}
        <div className="relative">
          <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrer en direct par expression régulière ou texte..."
            className="w-full bg-slate-950 text-xs text-slate-200 placeholder-slate-600 pl-9 pr-3 py-2 border border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500/70"
          />
          {filterText && (
            <button
              onClick={() => setFilterText("")}
              className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 text-xs"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Live Search Highlighter */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Surligner un terme dans le terminal..."
            className="w-full bg-slate-950 text-xs text-slate-200 placeholder-slate-600 pl-9 pr-3 py-2 border border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500/70"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 text-xs"
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Main Terminal-Style Scroll Container */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 bg-red-950/50 border border-red-500/30 text-red-300 text-xs rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={connectWebSocket}
              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded font-semibold text-[10px] uppercase font-mono"
            >
              Réessayer
            </button>
          </div>
        )}

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs select-text space-y-1 scroll-smooth custom-scrollbar"
          style={{ backgroundColor: "#040810" }}
        >
          {filteredLines.map((line) => (
            <div
              key={line.id}
              className={`flex items-start gap-3 py-0.5 px-1.5 rounded hover:bg-slate-900/40 transition-colors ${
                line.level === "error"
                  ? "bg-red-500/5"
                  : line.level === "warn"
                  ? "bg-amber-500/5"
                  : line.level === "success"
                  ? "bg-emerald-500/5"
                  : ""
              }`}
            >
              {/* Badge level descriptor */}
              <span
                className={`w-14 shrink-0 text-center text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                  line.level === "error"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : line.level === "warn"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : line.level === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : line.level === "info"
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    : "bg-slate-800 text-slate-400 border-slate-700/50"
                }`}
              >
                {line.level === "unknown" ? "LOG" : line.level.toUpperCase()}
              </span>

              {/* Message content */}
              <span className="flex-1 break-all whitespace-pre-wrap leading-relaxed text-slate-300">
                {highlightMessage(line)}
              </span>
            </div>
          ))}

          {filteredLines.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
              <TerminalIcon className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
              <p className="font-semibold text-xs text-slate-400">Aucune ligne de journal correspondante</p>
              <p className="text-[10px] text-slate-600 mt-1 max-w-sm">
                Attendez de nouveaux événements ou ajustez vos requêtes de filtrage en cours.
              </p>
            </div>
          )}
        </div>

        {/* Float Controls on the right bottom of the logger screen */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
          {/* Pause stream */}
          <button
            onClick={togglePause}
            className={`p-2.5 rounded-full shadow-lg border text-slate-100 flex items-center justify-center transition-all ${
              isPaused
                ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500"
                : "bg-slate-900 hover:bg-slate-800 border-slate-700"
            }`}
            title={isPaused ? "Reprendre le flux en direct" : "Mettre en pause le flux"}
          >
            {isPaused ? <Play className="w-4 h-4 fill-slate-100" /> : <Pause className="w-4 h-4 fill-slate-100" />}
          </button>

          {/* Auto Scroll lock */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-2.5 rounded-full shadow-lg border flex items-center justify-center transition-all ${
              autoScroll
                ? "bg-emerald-600 border-emerald-500 text-slate-100"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title={autoScroll ? "Défilement auto actif" : "Défilement auto inactif"}
          >
            <ArrowDown className={`w-4 h-4 ${autoScroll ? "animate-bounce" : ""}`} />
          </button>

          {/* Clear screen */}
          <button
            onClick={clearLogs}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-red-400 hover:text-red-300 rounded-full shadow-lg transition-all flex items-center justify-center"
            title="Effacer le journal local"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
