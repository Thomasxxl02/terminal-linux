import React, { useState } from "react";
import {
  Network,
  Search,
  Wifi,
  Layers,
  Clock,
  Server,
  Terminal as TermIcon,
  Cpu,
  User,
  Trash2,
  ChevronUp,
  ChevronDown,
  Info,
} from "lucide-react";
import { SystemStats, SystemProcess } from "../types";

interface TabProps {
  stats: SystemStats;
}

/** ── Onglet Réseau : interfaces détectées + filtre local ── */
export const NetworkTab: React.FC<TabProps> = ({ stats }) => {
  const [netFilterQuery, setNetFilterQuery] = useState("");

  const netInterfaces = (stats.networkInterfaces || []).filter((iface) => {
    const q = netFilterQuery.toLowerCase();
    return (
      !q ||
      iface.name.toLowerCase().includes(q) ||
      iface.address.toLowerCase().includes(q)
    );
  });

  return (
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
                  <span className="text-cyan-400 font-bold">{iface.address}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-850">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Masque</span>
                  <span className="text-slate-300">{iface.netmask || "N/A"}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-slate-500 text-xs font-mono bg-slate-900/40 rounded-xl border border-slate-800">
            Aucune interface ne correspond au filtre "{netFilterQuery}"
          </div>
        )}
      </div>
    </div>
  );
};

/** ── Onglet Node.js : runtime, uptime, sessions PTY, mémoire V8 ── */
export const NodeTab: React.FC<TabProps> = ({ stats }) => {
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono uppercase">
            <Layers className="w-4 h-4" /> Node.js Environment
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono">
            {stats.nodeRuntime?.nodeVersion || (typeof process !== "undefined" ? process.version : "N/A")}
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
  );
};

/** ── Onglet Matériel : architecture, utilisateur, cœurs CPU ── */
export const HardwareTab: React.FC<TabProps> = ({ stats }) => {
  return (
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
  );
};

/** ── Table des processus TOP : filtre, tri, SIGTERM (states locaux) ── */
export const ProcessesTable: React.FC<{
  stats: SystemStats;
  onKillProcess: (pid: number) => Promise<void>;
}> = ({ stats, onKillProcess }) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [sortField, setSortField] = useState<"pid" | "cpu" | "mem" | "name" | "user">("cpu");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPidToKill, setSelectedPidToKill] = useState<number | null>(null);
  const [killMessage, setKillMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleSort = (field: "pid" | "cpu" | "mem" | "name" | "user") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleKillProcess = async (pid: number) => {
    try {
      await onKillProcess(pid);
      setKillMessage({ text: `✓ Le processus ${pid} a été arrêté`, isError: false });
      setSelectedPidToKill(null);
    } catch (err) {
      setKillMessage({
        text: `✗ Impossible d'arrêter le processus ${pid}`,
        isError: true,
      });
      setSelectedPidToKill(null);
    }
  };

  const processesList: SystemProcess[] = stats.processes || [];
  const filteredProcesses = processesList
    .filter((p) => {
      const q = filterQuery.toLowerCase();
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        String(p.pid).includes(q) ||
        p.user.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let valA: string | number = a[sortField] as string | number;
      let valB: string | number = b[sortField] as string | number;

      if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-5">
      {killMessage && (
        <div
          className={`px-4 py-2.5 rounded-lg text-xs font-mono border ${
            killMessage.isError
              ? "bg-red-500/10 border-red-500/30 text-red-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          }`}
        >
          {killMessage.text}
        </div>
      )}

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
                {(["pid", "name", "user", "cpu", "mem"] as const).map((field) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`p-3 cursor-pointer hover:bg-slate-900/60 select-none hover:text-slate-200 transition-colors ${
                      field === "cpu" || field === "mem" ? "text-right" : ""
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 ${field === "cpu" || field === "mem" ? "justify-end" : ""}`}>
                      {field === "pid" ? "PID" : field === "name" ? "COMMANDE / PROCESSUS" : field === "user" ? "USER" : field === "cpu" ? "% CPU" : "% MEM"}
                      {sortField === field && (sortAsc ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />)}
                    </div>
                  </th>
                ))}
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
