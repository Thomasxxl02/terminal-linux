import React, { useState, useEffect } from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  Server,
  Clock,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
  Shield,
  Check,
  AlertTriangle,
  Database,
  Terminal as TermIcon,
  ChevronDown,
  ChevronUp,
  Info,
  Network,
  Wifi,
  Layers,
  Copy,
  User,
  Folder,
  Gauge,
  FileText,
} from "lucide-react";
import { SystemStats, SystemProcess } from "../types";

interface SystemMonitorModalProps {
  stats: SystemStats | null;
  onRefresh: () => void;
}

// Custom interactive SVG line & area chart component
const MetricChart: React.FC<{
  data: { cpu: number; mem: number; time: string }[];
  metric: "cpu" | "mem";
  color: string;
  gradientId: string;
}> = ({ data, metric, color, gradientId }) => {
  if (data.length < 2) {
    return (
      <div className="h-32 flex flex-col items-center justify-center text-slate-500 font-mono text-[10px] bg-slate-950/40 rounded-xl border border-slate-900/60 p-4">
        <RefreshCw className="w-4 h-4 animate-spin text-slate-600 mb-2" />
        Accumulation des points de données de télémétrie en cours...
      </div>
    );
  }

  const width = 500;
  const height = 130;
  const padding = 12;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((d, index) => {
    const val = metric === "cpu" ? d.cpu : d.mem;
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const boundedVal = Math.min(100, Math.max(0, val));
    const y = padding + chartHeight - (boundedVal / 100) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `
    ${linePath} 
    L ${points[points.length - 1].x.toFixed(1)} ${(height - padding).toFixed(1)} 
    L ${points[0].x.toFixed(1)} ${(height - padding).toFixed(1)} 
    Z
  `;

  return (
    <div className="relative w-full h-36 bg-slate-950/70 rounded-xl border border-slate-900/60 p-2 overflow-hidden shadow-inner">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.2" />
        <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.2" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="0.5" opacity="0.4" />

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

        {points.length > 0 && (
          <g>
            <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="5" fill={color} className="animate-pulse" opacity="0.8" />
            <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill="#020617" stroke={color} strokeWidth="1.5" />
          </g>
        )}
      </svg>
      
      <div className="absolute top-2.5 left-3 flex items-center gap-1.5 text-[9px] font-mono tracking-widest text-slate-500 font-bold uppercase">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
        <span>TENDANCE {metric === "cpu" ? "PROCESSEUR" : "RAM"}</span>
      </div>

      <div className="absolute bottom-2 right-3 text-[8px] font-mono text-slate-500">
        Historique : {data.length} pts
      </div>
    </div>
  );
};

export const SystemMonitorModal: React.FC<SystemMonitorModalProps> = ({
  stats,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "network" | "node" | "hardware" | "processes">("overview");
  const [history, setHistory] = useState<{ cpu: number; mem: number; time: string }[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [netFilterQuery, setNetFilterQuery] = useState("");
  const [sortField, setSortField] = useState<"pid" | "cpu" | "mem" | "name" | "user">("cpu");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPidToKill, setSelectedPidToKill] = useState<number | null>(null);
  const [killMessage, setKillMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Sync / Build real-time timeline telemetry history
  useEffect(() => {
    if (stats) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const approxCpu = stats.cpus > 0 
        ? Math.min(100, Math.round((stats.loadavg[0] / stats.cpus) * 100))
        : stats.memUsagePercent;

      setHistory((prev) => {
        const next = [...prev, { cpu: approxCpu, mem: stats.memUsagePercent, time: timeStr }];
        if (next.length > 20) {
          return next.slice(1);
        }
        return next;
      });
    }
  }, [stats]);

  useEffect(() => {
    if (killMessage) {
      const timer = setTimeout(() => {
        setKillMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [killMessage]);

  if (!stats) {
    return (
      <div className="flex-1 bg-slate-950 text-slate-200 p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-xs font-mono">Chargement des télémétries système en cours...</p>
        </div>
      </div>
    );
  }

  const formatUptime = (sec: number) => {
    const days = Math.floor(sec / 86400);
    const hrs = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (days > 0) return `${days}j ${hrs}h ${mins}m`;
    return `${hrs}h ${mins}m`;
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const ramUsedGB = formatBytes(stats.usedMem, 2);
  const ramTotalGB = formatBytes(stats.totalMem, 2);
  const ramFreeGB = formatBytes(stats.freeMem, 2);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleKillProcess = async (pid: number) => {
    try {
      const res = await fetch("/api/system/kill-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid }),
      });
      const data = await res.json();
      if (res.ok) {
        setKillMessage({ text: `✓ ${data.message || "Processus arrêté."}`, isError: false });
        setSelectedPidToKill(null);
        onRefresh();
      } else {
        setKillMessage({ text: `✗ Erreur : ${data.error || "Impossible d'arrêter le processus."}`, isError: true });
        setSelectedPidToKill(null);
      }
    } catch (err: any) {
      setKillMessage({ text: `✗ Exception : ${err.message}`, isError: true });
      setSelectedPidToKill(null);
    }
  };

  const handleCopySystemReport = () => {
    const reportLines = [
      `=== RAPPORT DE TÉLÉMÉTRIE SYSTÈME MACHINE ===`,
      `Date : ${new Date().toLocaleString()}`,
      `Système : ${stats.platform} (${stats.arch}) | Release: ${stats.release}`,
      `Hostname : ${stats.hostname}`,
      `Processeur : ${stats.cpuModel} (${stats.cpus} Cœurs)`,
      `Moyenne de Charge : ${stats.loadavg.map((l) => l.toFixed(2)).join(", ")}`,
      `RAM : ${ramUsedGB} / ${ramTotalGB} (${stats.memUsagePercent}% utilisé, libre: ${ramFreeGB})`,
      `Disque : ${stats.disk ? `${formatBytes(stats.disk.used, 1)} / ${formatBytes(stats.disk.total, 1)} (${stats.disk.percent}%)` : 'N/A'}`,
      `Node.js Runtime : ${stats.nodeRuntime?.nodeVersion || process.version}`,
      `Uptime : ${formatUptime(stats.uptime)}`,
      `Interfaces Réseau : ${(stats.networkInterfaces || []).map(i => `${i.name} (${i.address})`).join(", ")}`,
    ];
    navigator.clipboard.writeText(reportLines.join("\n"));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  const handleSort = (field: "pid" | "cpu" | "mem" | "name" | "user") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filter & Sort processes
  const processesList: SystemProcess[] = stats.processes || [];
  const filteredProcesses = processesList
    .filter((p) => {
      const query = filterQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        p.pid.toString().includes(query) ||
        p.user.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const netInterfaces = (stats.networkInterfaces || []).filter((iface) => {
    const q = netFilterQuery.toLowerCase();
    return (
      iface.name.toLowerCase().includes(q) ||
      iface.address.toLowerCase().includes(q) ||
      iface.family.toLowerCase().includes(q) ||
      iface.mac.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 bg-slate-950 text-slate-200 p-6 overflow-y-auto custom-scrollbar space-y-6 select-none">
      
      {/* Feedback Alert Overlay Banner */}
      {killMessage && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-mono shadow-lg transition-all ${
          killMessage.isError 
            ? "bg-red-500/10 border-red-500/30 text-red-400" 
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        }`}>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0" />
            <span>{killMessage.text}</span>
          </div>
          <button onClick={() => setKillMessage(null)} className="hover:text-slate-100">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Stats Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-6 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shadow-inner shrink-0">
            <Activity className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 flex-wrap">
              Centre de Télémétries & Ressources Système
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Performance & Diagnostics
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Diagnostics bas niveau en temps réel du processeur, allocations de la RAM, partitions disque, interfaces réseau et runtime Node.js.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySystemReport}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold font-mono flex items-center gap-2 transition-all shadow-md shrink-0"
            title="Copier le rapport système détaillé dans le presse-papier"
          >
            {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
            {copiedReport ? "Copié !" : "Copier le rapport"}
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold font-mono flex items-center gap-2 transition-all shadow-md shrink-0 disabled:text-slate-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? "animate-spin" : ""}`} /> 
            {isRefreshing ? "Actualisation..." : "Forcer l'actualisation"}
          </button>
        </div>
      </div>

      {/* Modal View Tabs Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto custom-scrollbar text-xs font-mono font-bold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "overview"
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Gauge className="w-3.5 h-3.5" /> Vue Globale
        </button>

        <button
          onClick={() => setActiveTab("network")}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "network"
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Network className="w-3.5 h-3.5" /> Réseau & IPs ({stats.networkInterfaces?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("node")}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "node"
              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Node.js & Memory
        </button>

        <button
          onClick={() => setActiveTab("hardware")}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "hardware"
              ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" /> Matériel & Coeurs ({stats.cpus})
        </button>

        <button
          onClick={() => setActiveTab("processes")}
          className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeTab === "processes"
              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <TermIcon className="w-3.5 h-3.5" /> Processus TOP ({stats.processes?.length || 0})
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Grid of Resource Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Processor Load averages */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold font-mono uppercase text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4" /> PROCESSEUR
                  </span>
                  <span>{stats.cpus} Coeurs</span>
                </div>
                <div className="text-sm font-bold text-slate-200 truncate" title={stats.cpuModel}>
                  {stats.cpuModel}
                </div>
              </div>
              <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
                <span className="text-[10px] text-slate-500 font-mono font-bold block uppercase">Moyenne de Charge :</span>
                <div className="grid grid-cols-3 gap-1 text-center text-xs font-mono text-slate-300">
                  <div className="bg-slate-950 p-1 rounded border border-slate-900">
                    <span className="text-[8px] text-slate-500 block">1 MIN</span>
                    <span className="font-bold text-emerald-400">{stats.loadavg[0].toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-950 p-1 rounded border border-slate-900">
                    <span className="text-[8px] text-slate-500 block">5 MIN</span>
                    <span className="font-bold text-emerald-400">{stats.loadavg[1].toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-950 p-1 rounded border border-slate-900">
                    <span className="text-[8px] text-slate-500 block">15 MIN</span>
                    <span className="font-bold text-emerald-400">{stats.loadavg[2].toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Memory (RAM) Allocation */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold font-mono uppercase text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <Server className="w-4 h-4" /> MÉMOIRE RAM
                  </span>
                  <span>{stats.memUsagePercent}%</span>
                </div>
                <div className="text-base font-bold text-slate-100 font-mono">
                  {ramUsedGB} / {ramTotalGB}
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850 relative">
                  <div
                    className={`h-full transition-all duration-500 ${
                      stats.memUsagePercent > 85 ? "bg-red-500" : stats.memUsagePercent > 65 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${stats.memUsagePercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-mono uppercase">
                  <span>Libre : {ramFreeGB}</span>
                  <span>Utilisé : {stats.memUsagePercent}%</span>
                </div>
              </div>
            </div>

            {/* Card 3: Storage (SSD) */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold font-mono uppercase text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-4 h-4" /> ESPACE DISQUE
                  </span>
                  <span>{stats.disk ? `${stats.disk.percent}%` : "0%"}</span>
                </div>
                <div className="text-base font-bold text-slate-100 font-mono">
                  {stats.disk ? `${formatBytes(stats.disk.used, 1)} / ${formatBytes(stats.disk.total, 1)}` : "Indisponible"}
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850 relative">
                  <div
                    className={`h-full transition-all duration-500 ${
                      stats.disk && stats.disk.percent > 85 ? "bg-red-500 animate-pulse" : "bg-amber-500"
                    }`}
                    style={{ width: `${stats.disk ? stats.disk.percent : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-mono uppercase">
                  <span>Disponible : {stats.disk ? formatBytes(stats.disk.free, 1) : "N/A"}</span>
                  {stats.disk && stats.disk.percent > 85 && (
                    <span className="text-red-400 flex items-center gap-0.5 animate-pulse font-bold">
                      <AlertTriangle className="w-2.5 h-2.5" /> CRITIQUE
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Operating System */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3 shadow-md">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold font-mono uppercase text-indigo-400">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4" /> NOYAU & SYSTÈME
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-200 font-mono truncate">
                  {stats.platform} ({stats.arch})
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  Release : {stats.release}
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
                <span className="text-[10px] text-slate-500 font-mono font-bold block uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-indigo-500" /> TEMPS DE FONCTIONNEMENT
                </span>
                <div className="text-xs font-mono font-bold text-slate-300">
                  {formatUptime(stats.uptime)}
                </div>
              </div>
            </div>

          </div>

          {/* Real-time Trend Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" /> Analyseur de Charge CPU Historique
                </h3>
                <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Moyenne : {stats.loadavg[0].toFixed(2)}
                </span>
              </div>
              <MetricChart data={history} metric="cpu" color="#10b981" gradientId="cpuGrad" />
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" /> Enregistreur d'Occupation RAM
                </h3>
                <span className="text-[10px] font-mono font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  Usage : {stats.memUsagePercent}%
                </span>
              </div>
              <MetricChart data={history} metric="mem" color="#06b6d4" gradientId="ramGrad" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NETWORK INTERFACES */}
      {activeTab === "network" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" /> Interfaces Réseau Détectées ({stats.networkInterfaces?.length || 0})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Adresses IP (IPv4 / IPv6), cartes Ethernet, interfaces de bouclage et masques réseau.
              </p>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filtrer par IP ou interface..."
                value={netFilterQuery}
                onChange={(e) => setNetFilterQuery(e.target.value)}
                className="w-full bg-slate-950 text-slate-300 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {netInterfaces.length > 0 ? (
              netInterfaces.map((iface, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <Wifi className={`w-4 h-4 ${iface.internal ? "text-slate-500" : "text-emerald-400"}`} />
                      <span className="text-sm font-bold font-mono text-slate-200">{iface.name}</span>
                    </div>
                    <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full uppercase ${
                      iface.internal 
                        ? "bg-slate-800 text-slate-400" 
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {iface.internal ? "Bouclage interne" : "Interface Externe"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-950 p-2 rounded border border-slate-850">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Adresse IP</span>
                      <span className="text-slate-200 font-bold">{iface.address}</span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded border border-slate-850">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Protocole</span>
                      <span className="text-cyan-400 font-bold">{iface.family}</span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded border border-slate-850">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Adresse MAC</span>
                      <span className="text-slate-400 truncate block">{iface.mac || "Non spécifiée"}</span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded border border-slate-850">
                      <span className="text-[9px] text-slate-500 block uppercase font-bold">Masque réseau</span>
                      <span className="text-slate-400 truncate block">{iface.netmask || "N/A"}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 bg-slate-900 p-8 text-center rounded-xl border border-slate-800 text-slate-500 text-xs font-mono">
                Aucune interface ne correspond au filtre "{netFilterQuery}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: NODE.JS & RUNTIME */}
      {activeTab === "node" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono uppercase">
                <Layers className="w-4 h-4" /> Node.js Environment
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">
                {stats.nodeRuntime?.nodeVersion || process.version}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Moteur V8 : {stats.nodeRuntime?.v8Version || "Non spécifié"}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono uppercase">
                <Clock className="w-4 h-4" /> Runtime Server Uptime
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">
                {formatUptime(stats.nodeRuntime?.processUptime || 0)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                PID Serveur Node : {stats.nodeRuntime?.pid || "3000"}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold font-mono uppercase">
                <TermIcon className="w-4 h-4" /> Sessions PTY Actives
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">
                {stats.activePtySessions ?? 1} Terminal(s)
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Gestionnaire de terminaux bidirectionnels
              </div>
            </div>
          </div>

          {/* Node Memory Heap breakdown */}
          {stats.nodeRuntime?.memoryUsage && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" /> Empreinte Mémoire du Serveur Node (V8 Heap & RSS)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block font-bold">RSS (Resident Set Size)</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {formatBytes(stats.nodeRuntime.memoryUsage.rss)}
                  </span>
                  <span className="text-[9px] text-slate-500 block">Total mémoire RAM allouée au processus</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block font-bold">Heap Total V8</span>
                  <span className="text-sm font-bold font-mono text-cyan-400">
                    {formatBytes(stats.nodeRuntime.memoryUsage.heapTotal)}
                  </span>
                  <span className="text-[9px] text-slate-500 block">Taille totale réservée pour les objets JS</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block font-bold">Heap Utilisé</span>
                  <span className="text-sm font-bold font-mono text-indigo-400">
                    {formatBytes(stats.nodeRuntime.memoryUsage.heapUsed)}
                  </span>
                  <span className="text-[9px] text-slate-500 block">Mémoire activement occupée par le code</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: HARDWARE & CORES */}
      {activeTab === "hardware" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block">Architecture CPU</span>
              <span className="text-sm font-bold text-slate-200 font-mono">{stats.arch}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block">Profil Utilisateur</span>
              <span className="text-sm font-bold text-slate-200 font-mono flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                {stats.userInfo?.username || "root"}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase font-bold block">Dossier Temporaire</span>
              <span className="text-xs font-bold text-slate-300 font-mono truncate block" title={stats.systemDetails?.tmpdir || "/tmp"}>
                {stats.systemDetails?.tmpdir || "/tmp"}
              </span>
            </div>
          </div>

          {/* Cores Details Grid */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" /> Détail des Cœurs de Processeur ({stats.cpus} Coeurs)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {(stats.cpuCores || Array.from({ length: stats.cpus }).map((_, i) => ({ core: i + 1, model: stats.cpuModel, speed: 2400 }))).map((coreItem) => (
                <div key={coreItem.core} className="bg-slate-950 border border-slate-850 p-3 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span className="text-emerald-400">Cœur #{coreItem.core}</span>
                    <span className="text-slate-500 text-[10px]">{coreItem.speed > 0 ? `${coreItem.speed} MHz` : 'Actif'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate" title={coreItem.model}>
                    {coreItem.model}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5 / MAIN PROCESSES (TOP) */}
      {(activeTab === "overview" || activeTab === "processes") && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <TermIcon className="w-4 h-4 text-emerald-400" /> Gestionnaire de Processus (TOP)
              </h3>
              <p className="text-[11px] text-slate-500">
                Processus ordonnancés les plus gourmands en ressources CPU. Utilisez l'action d'arrêt pour purger.
              </p>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Filtrer par PID, nom ou utilisateur..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-slate-950 text-slate-300 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar border border-slate-850 rounded-lg">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th 
                    onClick={() => handleSort("pid")}
                    className="p-3 cursor-pointer hover:bg-slate-900/60 select-none hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      PID
                      {sortField === "pid" && (sortAsc ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("name")}
                    className="p-3 cursor-pointer hover:bg-slate-900/60 select-none hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      COMMANDE / PROCESSUS
                      {sortField === "name" && (sortAsc ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("user")}
                    className="p-3 cursor-pointer hover:bg-slate-900/60 select-none hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      USER
                      {sortField === "user" && (sortAsc ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("cpu")}
                    className="p-3 cursor-pointer hover:bg-slate-900/60 select-none text-right hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      % CPU
                      {sortField === "cpu" && (sortAsc ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("mem")}
                    className="p-3 cursor-pointer hover:bg-slate-900/60 select-none text-right hover:text-slate-200 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      % MEM
                      {sortField === "mem" && (sortAsc ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />)}
                    </div>
                  </th>
                  <th className="p-3 text-center">SIGNAL ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                {filteredProcesses.length > 0 ? (
                  filteredProcesses.map((p) => {
                    const isConfirmingKill = selectedPidToKill === p.pid;
                    return (
                      <tr key={p.pid} className="hover:bg-slate-850/40 transition-colors">
                        <td className="p-3 text-slate-400 font-bold">{p.pid}</td>
                        <td className="p-3 text-slate-100 max-w-xs md:max-w-md truncate" title={p.name}>
                          {p.name}
                        </td>
                        <td className="p-3 text-slate-400 text-xs">{p.user}</td>
                        <td className="p-3 text-right text-emerald-400 font-bold">{p.cpu.toFixed(1)}%</td>
                        <td className="p-3 text-right text-cyan-400">{p.mem.toFixed(1)}%</td>
                        <td className="p-3 text-center">
                          {isConfirmingKill ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleKillProcess(p.pid)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-slate-100 font-bold text-[10px] rounded"
                              >
                                Confirmer
                              </button>
                              <button
                                onClick={() => setSelectedPidToKill(null)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedPidToKill(p.pid)}
                              className="inline-flex items-center gap-1 py-1 px-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-slate-950 font-bold rounded border border-red-500/20 hover:border-transparent transition-all text-[10px] uppercase tracking-wider"
                            >
                              <Trash2 className="w-3 h-3" /> SIGTERM
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                      Aucun processus ne correspond à votre filtre "{filterQuery}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security note footer */}
      <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">Note d'administration système :</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Le signal <code className="text-emerald-400 font-bold">SIGTERM (15)</code> demande poliment à un processus de se terminer, lui permettant de sauvegarder son état et de libérer ses descripteurs de fichiers proprement. Les processus appartenant au superutilisateur (root) ou au noyau système ne peuvent pas être terminés sans privilèges administratifs accrus.
          </p>
        </div>
      </div>

    </div>
  );
};
