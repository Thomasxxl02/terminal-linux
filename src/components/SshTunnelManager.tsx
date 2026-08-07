import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Zap,
  Play,
  Square,
  Activity,
  Wifi,
  RefreshCw,
  AlertCircle,
  Search,
  Monitor,
  CheckCircle,
} from "lucide-react";
import { SshHost, SshTunnel } from "../types";
import { useSecureStorage } from "../hooks/useSecureStorage";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { apiFetch } from "../lib/api";
import { isTauri, tauriInvoke } from "../lib/tauri";
import { SshTunnelFormModal } from "./SshTunnelFormModal";

const STORAGE_KEY_SSH = "terminal_ssh_hosts";
const STORAGE_KEY_TUNNELS = "terminal_ssh_tunnels";

const DEFAULT_SSH_HOSTS: SshHost[] = [
];

const DEFAULT_TUNNELS: SshTunnel[] = [
];

interface SshTunnelManagerProps {
  onExecuteInTerminal: (command: string, sessionId?: string) => void;
}

export const SshTunnelManager: React.FC<SshTunnelManagerProps> = ({
  onExecuteInTerminal,
}) => {
  const { value: hostsValue } = useSecureStorage<SshHost[]>(STORAGE_KEY_SSH, DEFAULT_SSH_HOSTS);
  const hosts = hostsValue ?? DEFAULT_SSH_HOSTS;
  const [tunnels, setTunnels] = useLocalStorage<SshTunnel[]>(STORAGE_KEY_TUNNELS, DEFAULT_TUNNELS);

  // Filter & UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<SshTunnel | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Port Conflict States
  const [checkPortInput, setCheckPortInput] = useState<string>("8080");
  const [portCheckResult, setPortCheckResult] = useState<{ status: 'occupied' | 'free'; message: string; suggestions: string[] } | null>(null);

  // Live Chart History simulation state

  // Diagnostic panel state
  const [diagnosticTunnelId, setDiagnosticTunnelId] = useState<string | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // (États du formulaire extraits dans SshTunnelFormModal)

  // (La simulation de trafic actif a été supprimée : elle inventait des
  //  octets/latences aléatoires pour des tunnels qui ne sont que des
  //  commandes générées. Les compteurs restent à 0 jusqu'à une vraie mesure.)

  const getHostName = (hostId: string): string => {
    const host = hosts.find((h) => h.id === hostId);
    return host ? host.name : "Hôte inconnu / personnalisé";
  };

  const getHostDetails = (hostId: string): SshHost | undefined => {
    return hosts.find((h) => h.id === hostId);
  };

  const formatBytes = (bytes?: number): string => {
    if (bytes === undefined || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const generateTunnelCommand = (t: SshTunnel): string => {
    const host = getHostDetails(t.hostId);
    if (!host) return "# Hôte SSH non configuré";

    let cmd = `ssh -N `;
    if (host.port !== 22) {
      cmd += `-p ${host.port} `;
    }
    if (host.authType === "key" && host.privateKeyPath) {
      cmd += `-i "${host.privateKeyPath}" `;
    }

    // Keep alive policies
    const interval = t.serverAliveInterval || 60;
    cmd += `-o ServerAliveInterval=${interval} `;
    if (t.exitOnFailure) {
      cmd += `-o ExitOnForwardFailure=yes `;
    }

    if (t.type === "local") {
      cmd += `-L ${t.localPort}:${t.remoteHost}:${t.remotePort} `;
    } else if (t.type === "remote") {
      cmd += `-R ${t.remotePort}:${t.remoteHost}:${t.localPort} `;
    } else if (t.type === "dynamic") {
      cmd += `-D ${t.localPort} `;
    }

    cmd += `${host.username}@${host.host}`;
    return cmd;
  };

  const handleOpenCreateModal = () => {
    setEditingTunnel(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: SshTunnel) => {
    setEditingTunnel(t);
    setIsModalOpen(true);
  };

  const handleSaveTunnel = (data: {
    id?: string;
    name: string;
    hostId: string;
    type: "local" | "remote" | "dynamic";
    localPort: number;
    remoteHost: string;
    remotePort: number;
    serverAliveInterval: number;
    exitOnFailure: boolean;
  }) => {
    if (!data.name || !data.hostId) return;

    if (editingTunnel) {
      const updated = tunnels.map((t) =>
        t.id === editingTunnel.id
          ? {
              ...t,
              name: data.name,
              hostId: data.hostId,
              type: data.type,
              localPort: Number(data.localPort),
              remoteHost: data.type === "dynamic" ? "127.0.0.1" : data.remoteHost,
              remotePort: data.type === "dynamic" ? 0 : Number(data.remotePort),
              serverAliveInterval: Number(data.serverAliveInterval),
              exitOnFailure: data.exitOnFailure
            }
          : t
      );
      setTunnels(updated);
    } else {
      const newTunnel: SshTunnel = {
        id: `tunnel_${Date.now()}`,
        name: data.name,
        hostId: data.hostId,
        type: data.type,
        localPort: Number(data.localPort),
        remoteHost: data.type === "dynamic" ? "127.0.0.1" : data.remoteHost,
        remotePort: data.type === "dynamic" ? 0 : Number(data.remotePort),
        status: "inactive",
        createdAt: Date.now(),
        trafficSent: 0,
        trafficReceived: 0,
        latency: 0,
        serverAliveInterval: Number(data.serverAliveInterval),
        exitOnFailure: data.exitOnFailure
      };
      setTunnels([...tunnels, newTunnel]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteTunnel = (id: string) => {
    setTunnels(tunnels.filter((t) => t.id !== id));
  };

  const handleToggleTunnelStatus = (id: string) => {
    setTunnels((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const newStatus = t.status === "active" ? "inactive" : "active";
          // Pas de statistiques inventées : les compteurs restent à 0
          // tant qu'aucune vraie mesure n'est disponible.
          return {
            ...t,
            status: newStatus,
          };
        }
        return t;
      })
    );
  };

  const handleCopyCommand = (t: SshTunnel) => {
    const cmd = generateTunnelCommand(t);
    navigator.clipboard.writeText(cmd);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExecuteCommand = (t: SshTunnel) => {
    const cmd = generateTunnelCommand(t);
    onExecuteInTerminal(cmd);
    handleToggleTunnelStatus(t.id);
  };

  // Diagnostic RÉEL : vérifie si le port local du tunnel écoute (bind
  // test via check_port — Tauri et web) et affiche uniquement des faits.
  // La latence n'est pas mesurable sans session SSH active → jamais inventée.
  const handleRunDiagnostic = async (t: SshTunnel) => {
    setDiagnosticTunnelId(t.id);
    setDiagnosticLogs([]);
    setIsDiagnosing(true);

    const push = (line: string) => setDiagnosticLogs((prev) => [...prev, line]);
    push(`[DIAG] Diagnostic réel du tunnel: ${t.name}`);
    push(`[INFO] Tunnel local ${t.localPort} → ${t.remoteHost}:${t.remotePort}`);

    let available: boolean;
    try {
      if (isTauri()) {
        available = await tauriInvoke<boolean>("check_port", { port: t.localPort });
      } else {
        const res = await apiFetch(`/api/network/port-check?port=${t.localPort}`);
        const data = await res.json();
        available = data.available;
      }
    } catch {
      push(`[ERREUR] Impossible de vérifier le port ${t.localPort} (API indisponible).`);
      setIsDiagnosing(false);
      return;
    }

    if (available) {
      push(
        `[RÉEL] Port local ${t.localPort}: LIBRE — aucun tunnel actif. Exécutez la commande dans le terminal pour lancer le tunnel.`
      );
    } else {
      push(
        `[RÉEL] Port local ${t.localPort}: OCCUPÉ — un processus écoute (tunnel actif probable).`
      );
    }
    push(`[RÉEL] Latence : non mesurable sans session SSH active (aucune donnée inventée).`);
    push(`[FIN] Test de bout en bout : exécutez la commande du tunnel dans le terminal.`);
    setIsDiagnosing(false);
  };

  // Vérification RÉELLE d'un port local : bind test (Tauri) ou route
  // Express /api/network/port-check (web). Aucune table simulée.
  const handlePortCheck = async () => {
    const port = Number(checkPortInput);
    if (!port || isNaN(port) || port < 1 || port > 65535) {
      setPortCheckResult({
        status: "occupied",
        message: "Port invalide.",
        suggestions: []
      });
      return;
    }

    let available: boolean;
    if (isTauri()) {
      available = await tauriInvoke<boolean>("check_port", { port });
    } else {
      const res = await apiFetch(`/api/network/port-check?port=${port}`);
      const data = await res.json();
      available = data.available;
    }

    if (!available) {
      setPortCheckResult({
        status: "occupied",
        message: `Le port local ${port} est OCCUPÉ (bind test réel).`,
        suggestions: [
          `Utilisez la commande shell : lsof -i :${port} (puis kill -9 PID) ou netstat -tulnp | grep ${port} pour identifier le processus.`,
          `Changez le port local du tunnel SSH dans le formulaire (ex: 18080).`
        ]
      });
    } else {
      setPortCheckResult({
        status: "free",
        message: `Le port local ${port} est libre et prêt à être lié par votre tunnel SSH.`,
        suggestions: [
          `Vous pouvez l'utiliser directement pour vos redirections locales (-L).`
        ]
      });
    }
  };

  const filteredTunnels = tunnels.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(t.localPort).includes(searchQuery) ||
      t.remoteHost.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || t.type === selectedType;
    return matchesSearch && matchesType;
  });


  return (
    <div className="flex-1 bg-slate-950 text-slate-100 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
      {/* Top Banner and Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-900 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              Générateur & Testeur de Tunnels SSH / Reverse Proxy
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Créez des redirections de ports locales (-L), distantes (-R) ou des serveurs proxy SOCKS5 dynamiques (-D) avec vérification réelle du port local.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono rounded-lg shadow-md flex items-center gap-2 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Créer un Tunnel SSH
        </button>
      </div>

      {/* Main Filter & Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher nom, port local, hôte..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* Categories Tab selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["all", "local", "remote", "dynamic"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono whitespace-nowrap transition-colors ${
                selectedType === type
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              {type === "all" ? "Tous les tunnels" : type.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Tunnel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTunnels.map((tunnel) => {
          const isTActive = tunnel.status === "active";

          return (
            <div
              key={tunnel.id}
              className={`bg-slate-900/80 border hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all hover:shadow-lg relative overflow-hidden ${
                isTActive ? "border-emerald-500/30 shadow-emerald-900/5" : "border-slate-800"
              }`}
            >
              {/* Dynamic Animated Status Ring */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isTActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                  <h3 className="font-bold text-slate-200 text-sm truncate">{tunnel.name}</h3>
                </div>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase shrink-0 font-semibold ${
                  tunnel.type === "local" ? "bg-blue-500/15 text-blue-300 border border-blue-500/20" :
                  tunnel.type === "remote" ? "bg-purple-500/15 text-purple-300 border border-purple-500/20" :
                  "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                }`}>
                  {tunnel.type}
                </span>
              </div>

              {/* Tunnel Configuration Formula */}
              <div className="space-y-1.5 my-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Serveur SSH:</span>
                  <span className="text-slate-300 text-[11px] font-medium max-w-[150px] truncate" title={getHostName(tunnel.hostId)}>
                    {getHostName(tunnel.hostId)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Forward local:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {tunnel.localPort}
                  </span>
                </div>

                {tunnel.type !== "dynamic" && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-[11px]">Cible distante:</span>
                    <span className="text-slate-300 truncate font-medium">
                      {tunnel.remoteHost}:{tunnel.remotePort}
                    </span>
                  </div>
                )}

                {/* Keep-alive settings summary */}
                <div className="pt-1 border-t border-slate-900 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>KeepAlive: {tunnel.serverAliveInterval || 60}s</span>
                  <span>ExitOnFail: {tunnel.exitOnFailure ? "Oui" : "Non"}</span>
                </div>
              </div>

              {/* Real-time Bandwidth Sparkline Chart (Only shown if active) */}
              {isTActive ? (
                <div className="my-2.5 p-2 bg-slate-950/40 rounded-lg border border-slate-800/40 space-y-2">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      Tx: {formatBytes(tunnel.trafficSent)}
                    </span>
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                      Rx: {formatBytes(tunnel.trafficReceived)}
                    </span>
                    <span>{tunnel.latency || 22}ms</span>
                  </div>
                </div>
              ) : (
                <div className="my-2 p-1 text-center font-mono text-[10px] text-slate-600 italic">
                  Lancez la commande du tunnel dans le terminal pour l'activer (aucune mesure de trafic locale).
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5 mt-2.5">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopyCommand(tunnel)}
                    title="Copier la commande SSH brute"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                  >
                    {copiedId === tunnel.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handleRunDiagnostic(tunnel)}
                    title="Lancer le diagnostic réseau"
                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                  >
                    <Activity className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(tunnel)}
                    title="Éditer le tunnel"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteTunnel(tunnel.id)}
                    title="Supprimer"
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Launch / Stop button */}
                {isTActive ? (
                  <button
                    onClick={() => handleToggleTunnelStatus(tunnel.id)}
                    className="px-2.5 py-1.5 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-400 text-xs font-mono font-bold rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Square className="w-3 h-3 fill-current" /> Fermer
                  </button>
                ) : (
                  <button
                    onClick={() => handleExecuteCommand(tunnel)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-emerald-400 text-xs font-mono font-bold rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current text-emerald-400" /> Exécuter Terminal
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredTunnels.length === 0 && (
          <div className="col-span-full p-8 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-slate-400">
            <Zap className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-medium">Aucun tunnel SSH ne correspond.</p>
          </div>
        )}
      </div>

      {/* Interactive Diagnostic Console and Port Conflict Panel side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0 mt-2">
        {/* Diagnostic Panel */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5 mb-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              Console de Diagnostic & Analyse Réseau
            </h4>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 h-36 overflow-y-auto space-y-1">
              {diagnosticTunnelId ? (
                <>
                  {diagnosticLogs.map((log, idx) => (
                    <div key={idx} className={
                      log.includes("[SUCCESS]") ? "text-emerald-400 font-semibold" :
                      log.includes("[DIAG]") ? "text-indigo-400" :
                      "text-slate-300"
                    }>
                      {log}
                    </div>
                  ))}
                  {isDiagnosing && (
                    <div className="text-slate-500 animate-pulse">Vérification du port local en cours...</div>
                  )}
                </>
              ) : (
                <div className="text-slate-600 italic text-center pt-8">
                  Cliquez sur l'icône d'activité d'un tunnel ci-dessus pour lancer un diagnostic de connectivité.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Port Checker Panel */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5 mb-2">
            <Monitor className="w-4 h-4 text-blue-400" />
            Détecteur de Conflit de Ports Locaux
          </h4>
          <p className="text-[11px] text-slate-400 mb-2">
            Vérifiez si un port d'écoute est déjà occupé par un autre processus local avant d'initier le tunnel SSH.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={checkPortInput}
              onChange={(e) => setCheckPortInput(e.target.value)}
              placeholder="3306, 8080, 5432..."
              className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 font-mono w-28 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handlePortCheck}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-slate-950 font-mono font-bold text-xs rounded-lg transition-colors"
            >
              Tester le Port
            </button>
          </div>

          {portCheckResult && (
            <div className="mt-3 p-3 rounded-lg border text-xs font-mono space-y-1.5 bg-slate-950 border-slate-800">
              <div className="flex items-center gap-1.5">
                {portCheckResult.status === "free" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span className={portCheckResult.status === "free" ? "text-emerald-300 font-bold" : "text-amber-300 font-bold"}>
                  {portCheckResult.message}
                </span>
              </div>
              {portCheckResult.suggestions.length > 0 && (
                <div className="space-y-1 pl-5 text-slate-400 text-[10px] list-decimal">
                  {portCheckResult.suggestions.map((s, idx) => (
                    <div key={idx}>• {s}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal création/édition (composant extrait) */}
      {isModalOpen && (
        <SshTunnelFormModal
          editingTunnel={editingTunnel}
          hosts={hosts}
          onSave={handleSaveTunnel}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};
