import React, { useState, useEffect } from "react";
import {
  Key,
  Server,
  Terminal,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Shield,
  Radio,
  Globe,
  Lock,
  ArrowRight,
  Zap,
  Play,
  Square,
  Activity,
  Wifi,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Search,
  ExternalLink,
  ChevronRight,
  Monitor,
  CheckCircle,
  XCircle,
  Workflow,
  Sparkles
} from "lucide-react";
import { SshHost, SshTunnel, TerminalSessionInfo } from "../types";
import { useSecureStorage } from "../hooks/useSecureStorage";
import { useLocalStorage } from "../hooks/useLocalStorage";

const STORAGE_KEY_SSH = "terminal_ssh_hosts";
const STORAGE_KEY_TUNNELS = "terminal_ssh_tunnels";

const DEFAULT_SSH_HOSTS: SshHost[] = [
  {
    id: "ssh-prod-1",
    name: "Serveur Prod West (Ubuntu 22.04)",
    host: "192.168.1.100",
    port: 22,
    username: "ubuntu",
    authType: "key",
    privateKeyPath: "~/.ssh/id_rsa_prod",
    category: "Production",
    color: "#10b981",
    description: "Serveur d'application principal avec docker & Nginx",
    tunnels: ["8080:localhost:80", "3306:localhost:3306"],
  },
  {
    id: "ssh-vps-staging",
    name: "VPS Staging (Debian 12)",
    host: "vps.staging-cloud.net",
    port: 2222,
    username: "deploy",
    authType: "key",
    privateKeyPath: "~/.ssh/id_ed25519",
    category: "Staging",
    color: "#3b82f6",
    description: "Environnement de recette & pré-production",
    tunnels: [],
  },
  {
    id: "ssh-db-tunnel",
    name: "Passerelle Database (PostgreSQL)",
    host: "db-gateway.internal",
    port: 22,
    username: "postgres_admin",
    authType: "key",
    privateKeyPath: "~/.ssh/db_key.pem",
    category: "Databases",
    color: "#8b5cf6",
    description: "Tunnel sécurisé vers l'instance Postgres privée",
    tunnels: ["5432:10.0.0.12:5432"],
  },
];

const DEFAULT_TUNNELS: SshTunnel[] = [
  {
    id: "tunnel-mysql",
    name: "Redirection MySQL Staging",
    hostId: "ssh-vps-staging",
    type: "local",
    localPort: 3306,
    remoteHost: "127.0.0.1",
    remotePort: 3306,
    status: "inactive",
    createdAt: Date.now() - 3600000 * 24,
    trafficSent: 154200,
    trafficReceived: 894500,
    latency: 35,
    serverAliveInterval: 60,
    exitOnFailure: true
  },
  {
    id: "tunnel-web",
    name: "Reverse Proxy Dev Webserver",
    hostId: "ssh-prod-1",
    type: "remote",
    localPort: 3000,
    remoteHost: "localhost",
    remotePort: 80,
    status: "inactive",
    createdAt: Date.now() - 3600000 * 48,
    trafficSent: 54100,
    trafficReceived: 213000,
    latency: 18,
    serverAliveInterval: 30,
    exitOnFailure: true
  },
  {
    id: "tunnel-socks",
    name: "SOCKS5 Proxy Navigation Sécurisée",
    hostId: "ssh-db-tunnel",
    type: "dynamic",
    localPort: 1080,
    remoteHost: "127.0.0.1",
    remotePort: 0,
    status: "inactive",
    createdAt: Date.now() - 3600000 * 12,
    trafficSent: 1205000,
    trafficReceived: 9845000,
    latency: 45,
    serverAliveInterval: 60,
    exitOnFailure: false
  }
];

interface SshTunnelManagerProps {
  onExecuteInTerminal: (command: string, sessionId?: string) => void;
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
}

export const SshTunnelManager: React.FC<SshTunnelManagerProps> = ({
  onExecuteInTerminal,
  sessions,
  activeSessionId,
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
  const [chartHistory, setChartHistory] = useState<Record<string, number[]>>({});

  // Diagnostic panel state
  const [diagnosticTunnelId, setDiagnosticTunnelId] = useState<string | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formHostId, setFormHostId] = useState("");
  const [formType, setFormType] = useState<'local' | 'remote' | 'dynamic'>("local");
  const [formLocalPort, setFormLocalPort] = useState<number>(8080);
  const [formRemoteHost, setFormRemoteHost] = useState("localhost");
  const [formRemotePort, setFormRemotePort] = useState<number>(80);
  const [formAliveInterval, setFormAliveInterval] = useState<number>(60);
  const [formExitOnFailure, setFormExitOnFailure] = useState<boolean>(true);

  // Update mock active traffic and chart history
  useEffect(() => {
    const timer = setInterval(() => {
      setTunnels((prevTunnels) =>
        prevTunnels.map((t) => {
          if (t.status === "active") {
            // Add some mock traffic increments
            const sentAdd = Math.floor(Math.random() * 5000) + 100;
            const recvAdd = Math.floor(Math.random() * 15000) + 500;
            const variance = Math.floor(Math.random() * 6) - 3;
            const newLatency = Math.max(5, (t.latency || 20) + variance);

            // Record history for sparkline
            const latestRate = (sentAdd + recvAdd) / 1024; // KB/s
            setChartHistory((prev) => {
              const currentList = prev[t.id] || Array(12).fill(10);
              const updatedList = [...currentList.slice(1), parseFloat(latestRate.toFixed(1))];
              return { ...prev, [t.id]: updatedList };
            });

            return {
              ...t,
              trafficSent: (t.trafficSent || 0) + sentAdd,
              trafficReceived: (t.trafficReceived || 0) + recvAdd,
              latency: newLatency,
            };
          }
          return t;
        })
      );
    }, 2000);

    return () => clearInterval(timer);
  }, [setTunnels]);

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
    setFormName("");
    setFormHostId(hosts[0]?.id || "");
    setFormType("local");
    setFormLocalPort(8080);
    setFormRemoteHost("localhost");
    setFormRemotePort(80);
    setFormAliveInterval(60);
    setFormExitOnFailure(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: SshTunnel) => {
    setEditingTunnel(t);
    setFormName(t.name);
    setFormHostId(t.hostId);
    setFormType(t.type);
    setFormLocalPort(t.localPort);
    setFormRemoteHost(t.remoteHost);
    setFormRemotePort(t.remotePort);
    setFormAliveInterval(t.serverAliveInterval || 60);
    setFormExitOnFailure(t.exitOnFailure !== false);
    setIsModalOpen(true);
  };

  const handleSaveTunnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formHostId) return;

    if (editingTunnel) {
      const updated = tunnels.map((t) =>
        t.id === editingTunnel.id
          ? {
              ...t,
              name: formName,
              hostId: formHostId,
              type: formType,
              localPort: Number(formLocalPort),
              remoteHost: formType === "dynamic" ? "127.0.0.1" : formRemoteHost,
              remotePort: formType === "dynamic" ? 0 : Number(formRemotePort),
              serverAliveInterval: Number(formAliveInterval),
              exitOnFailure: formExitOnFailure
            }
          : t
      );
      setTunnels(updated);
    } else {
      const newTunnel: SshTunnel = {
        id: `tunnel_${Date.now()}`,
        name: formName,
        hostId: formHostId,
        type: formType,
        localPort: Number(formLocalPort),
        remoteHost: formType === "dynamic" ? "127.0.0.1" : formRemoteHost,
        remotePort: formType === "dynamic" ? 0 : Number(formRemotePort),
        status: "inactive",
        createdAt: Date.now(),
        trafficSent: 0,
        trafficReceived: 0,
        latency: 0,
        serverAliveInterval: Number(formAliveInterval),
        exitOnFailure: formExitOnFailure
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
          // Initialize sparkline on activation
          if (newStatus === "active") {
            setChartHistory((prevHist) => ({
              ...prevHist,
              [t.id]: Array(12).fill(15)
            }));
          }
          return {
            ...t,
            status: newStatus,
            trafficSent: newStatus === "active" ? 1024 : t.trafficSent,
            trafficReceived: newStatus === "active" ? 2048 : t.trafficReceived,
            latency: newStatus === "active" ? 22 : 0,
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

  // Diagnostic tool simulator
  const handleRunDiagnostic = (t: SshTunnel) => {
    setDiagnosticTunnelId(t.id);
    setDiagnosticLogs([]);
    setIsDiagnosing(true);

    const logs = [
      `[DIAG] Test de diagnostic pour: ${t.name}`,
      `[CHECK] Résolution DNS de l'hôte distant... OK`,
      `[CHECK] Vérification du port local ${t.localPort}... Port disponible.`,
      `[SSH] Test d'initiation de la connexion asynchrone TCP...`,
      `[SSH] Protocole de tunneling: Prise en charge ${t.type.toUpperCase()}`,
      `[DIAG] Envoi de paquets de keep-alive (ServerAliveInterval: ${t.serverAliveInterval || 60}s)...`,
      `[SUCCESS] Test d'établissement du bridge local <=> distant réussi ! Latence estimée: ${t.latency || 25}ms`
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < logs.length) {
        setDiagnosticLogs((prev) => [...prev, logs[index]]);
        index++;
      } else {
        clearInterval(interval);
        setIsDiagnosing(false);
      }
    }, 400);
  };

  // Local Port Conflict Checker
  const handlePortCheck = () => {
    const port = Number(checkPortInput);
    if (!port || isNaN(port)) {
      setPortCheckResult({
        status: "occupied",
        message: "Port invalide.",
        suggestions: []
      });
      return;
    }

    // Common occupied services simulation
    const commonServices: Record<number, string> = {
      80: "Serveur Web HTTP (Nginx / Apache)",
      443: "Serveur Web Sécurisé HTTPS",
      3306: "Base de Données MySQL",
      5432: "Base de Données PostgreSQL",
      27017: "Base de Données MongoDB",
      6379: "Magasin de clés Redis",
      3000: "Application Node.js / React (Dev Server)",
      8080: "Serveur d'application alternatif (Tomcat, Jenkins)"
    };

    const isSimulatedOccupied = [80, 443, 3306, 3000].includes(port);

    if (isSimulatedOccupied) {
      setPortCheckResult({
        status: "occupied",
        message: `Attention! Le port local ${port} semble occupé par : ${commonServices[port] || "un processus système alternatif"}.`,
        suggestions: [
          `Arrêtez le service concurrent sur votre machine locale.`,
          `Utilisez la commande shell : lsof -i :${port} (puis kill -9 PID) ou netstat -tulnp | grep ${port} pour diagnostiquer.`,
          `Changez le port local du tunnel SSH dans le formulaire pour un port aléatoire libre (ex: 18080).`
        ]
      });
    } else {
      setPortCheckResult({
        status: "free",
        message: `Félicitations ! Le port local ${port} est libre et prêt à être lié par votre tunnel SSH.`,
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
            Créez des redirections de ports locales (-L), distantes (-R) ou des serveurs proxy SOCKS5 dynamiques (-D) avec diagnostic de bande passante intégré.
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
          const hist = chartHistory[tunnel.id] || Array(12).fill(5);

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

                  {/* Sparkline Drawing */}
                  <div className="h-6 w-full mt-1.5">
                    <svg className="w-full h-full" viewBox="0 0 120 20" preserveAspectRatio="none">
                      <path
                        d={`M ${hist.map((val, i) => `${(i * 120) / 11} ${Math.max(2, 20 - (val / 100) * 18)}`).join(" L ")}`}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="my-2 p-1 text-center font-mono text-[10px] text-slate-600 italic">
                  Activer le tunnel pour démarrer le monitoring d'échange de bande passante.
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
                    <div className="text-slate-500 animate-pulse">Test de poignée de main TCP en cours...</div>
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

      {/* Create / Edit Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Workflow className="w-4 h-4 text-emerald-400" />
                {editingTunnel ? "Éditer le Tunnel SSH" : "Nouveau Tunnel SSH / Port Forwarding"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleSaveTunnel} className="p-6 space-y-4 text-xs font-mono overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-slate-400 mb-1">Nom du Tunnel</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Redirection PostgreSQL"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Serveur d'Appui SSH (Hôte)</label>
                <select
                  value={formHostId}
                  onChange={(e) => setFormHostId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  {hosts.map((h) => (
                    <option key={h.id} value={h.id}>{h.name} ({h.host})</option>
                  ))}
                  {hosts.length === 0 && <option value="">Aucun hôte configuré</option>}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Type de Redirection (Forwarding Type)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType("local");
                      if (formLocalPort === 0) setFormLocalPort(8080);
                    }}
                    className={`py-1.5 px-2 border rounded text-center text-[10px] font-bold ${
                      formType === "local" ? "bg-blue-500/10 border-blue-500/30 text-blue-300" : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    Local (-L)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormType("remote");
                      if (formLocalPort === 0) setFormLocalPort(8080);
                    }}
                    className={`py-1.5 px-2 border rounded text-center text-[10px] font-bold ${
                      formType === "remote" ? "bg-purple-500/10 border-purple-500/30 text-purple-300" : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    Distant (-R)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormType("dynamic");
                      setFormLocalPort(1080);
                    }}
                    className={`py-1.5 px-2 border rounded text-center text-[10px] font-bold ${
                      formType === "dynamic" ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    SOCKS (-D)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Port Local d'Écoute</label>
                  <input
                    type="number"
                    value={formLocalPort}
                    onChange={(e) => setFormLocalPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {formType !== "dynamic" && (
                  <div>
                    <label className="block text-slate-400 mb-1">Port Distant Cible</label>
                    <input
                      type="number"
                      value={formRemotePort}
                      onChange={(e) => setFormRemotePort(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                )}
              </div>

              {formType !== "dynamic" && (
                <div>
                  <label className="block text-slate-400 mb-1">Hôte Distant Cible (Remote Host)</label>
                  <input
                    type="text"
                    value={formRemoteHost}
                    onChange={(e) => setFormRemoteHost(e.target.value)}
                    placeholder="localhost ou 127.0.0.1"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              )}

              {/* Keep-Alive details */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                <div>
                  <label className="block text-slate-400 mb-1" title="Envoi périodique de requêtes nulles pour maintenir actif le pont réseau">
                    Intervalle Keep-Alive
                  </label>
                  <select
                    value={formAliveInterval}
                    onChange={(e) => setFormAliveInterval(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={15}>15 secondes</option>
                    <option value={30}>30 secondes</option>
                    <option value={60}>60 secondes</option>
                    <option value={120}>120 secondes</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={formExitOnFailure}
                      onChange={(e) => setFormExitOnFailure(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-950 text-emerald-500 w-4 h-4 focus:ring-0 focus:outline-none"
                    />
                    <span title="Fermer le sous-processus de tunnelisation en cas de liaison impossible ou déjà lié">
                      Fermer si échec
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg shadow"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
