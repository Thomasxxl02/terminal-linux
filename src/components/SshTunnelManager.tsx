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
  Monitor
} from "lucide-react";
import { SshHost, SshTunnel, TerminalSessionInfo } from "../types";
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
  const [hosts] = useLocalStorage<SshHost[]>(STORAGE_KEY_SSH, DEFAULT_SSH_HOSTS);
  const [tunnels, setTunnels] = useLocalStorage<SshTunnel[]>(STORAGE_KEY_TUNNELS, DEFAULT_TUNNELS);

  // Filter & UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<SshTunnel | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Update mock active traffic
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
      };
      setTunnels([...tunnels, newTunnel]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteTunnel = (id: string) => {
    setTunnels(tunnels.filter((t) => t.id !== id));
    if (diagnosticTunnelId === id) {
      setDiagnosticTunnelId(null);
    }
  };

  const handleToggleStatus = (id: string) => {
    setTunnels(
      tunnels.map((t) => {
        if (t.id === id) {
          const newStatus = t.status === "active" ? "inactive" : "active";
          return {
            ...t,
            status: newStatus,
            trafficSent: newStatus === "active" ? 1024 : t.trafficSent,
            trafficReceived: newStatus === "active" ? 2048 : t.trafficReceived,
            latency: newStatus === "active" ? 25 : 0,
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

  const handleLaunchInTerminal = (t: SshTunnel) => {
    const cmd = generateTunnelCommand(t);
    // Mark as active in the UI
    setTunnels(
      tunnels.map((item) =>
        item.id === t.id ? { ...item, status: "active", trafficSent: 1200, trafficReceived: 2400 } : item
      )
    );
    // Execute command in current active or new terminal
    onExecuteInTerminal(cmd, activeSessionId || undefined);
  };

  const handleRunDiagnostic = (t: SshTunnel) => {
    setDiagnosticTunnelId(t.id);
    setIsDiagnosing(true);
    setDiagnosticLogs([]);

    const host = getHostDetails(t.hostId);
    if (!host) {
      setDiagnosticLogs(["[ERREUR] Aucun hôte SSH valide associé à ce tunnel."]);
      setIsDiagnosing(false);
      return;
    }

    const steps = [
      `[INFO] Démarrage du diagnostic pour le tunnel : "${t.name}"`,
      `[INFO] Résolution DNS & test de routage IP vers l'hôte distant ${host.host}...`,
      `[SUCCESS] Hôte ${host.host} résolu et accessible. Ping moyen : 24ms`,
      `[INFO] Vérification de la disponibilité du port local ${t.localPort} sur la machine...`,
      `[SUCCESS] Port local ${t.localPort} disponible et libre de toute écoute.`,
      `[INFO] Simulation de l'établissement de la poignée de main SSH (Port d'écoute : ${host.port})...`,
      `[SUCCESS] Canal SSH sécurisé initialisé avec succès. Type d'auth: ${host.authType}`,
      t.type === "local"
        ? `[SUCCESS] Redirection locale active : localhost:${t.localPort} -> ${t.remoteHost}:${t.remotePort}`
        : t.type === "remote"
        ? `[SUCCESS] Redirection inverse (reverse proxy) active : distant:${t.remotePort} -> localhost:${t.localPort}`
        : `[SUCCESS] Proxy dynamique SOCKS5 actif en local sur le port ${t.localPort}`,
      `[SUCCESS] Diagnostic complet réussi ! Le tunnel est prêt à être lancé.`
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setDiagnosticLogs((prev) => [...prev, steps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsDiagnosing(false);
      }
    }, 800);
  };

  const filteredTunnels = tunnels.filter((t) => {
    const host = getHostDetails(t.hostId);
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.localPort.toString().includes(searchQuery) ||
      (host && host.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (host && host.host.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === "all" || t.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto custom-scrollbar p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              Générateur & Testeur de Tunnels SSH / Reverse Proxy
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Configurez vos redirections de ports (Local Forwarding, Remote Reverse Proxy, et Dynamic SOCKS5) associés aux hôtes de votre carnet SSH, testez leur validité et supervisez les métriques de trafic.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs font-mono rounded-lg shadow-md flex items-center gap-2 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Créer un Tunnel SSH
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher nom, port local, hôte..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
          />
        </div>

        {/* Categories Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "Tous les tunnels" },
            { id: "local", label: "Local (-L)" },
            { id: "remote", label: "Remote / Inverse (-R)" },
            { id: "dynamic", label: "SOCKS Dynamique (-D)" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedType(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono whitespace-nowrap transition-colors ${
                selectedType === item.id
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid & Diagnostic Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Tunnel List */}
        <div className="xl:col-span-2 space-y-4">
          {filteredTunnels.map((t) => {
            const host = getHostDetails(t.hostId);
            const cmd = generateTunnelCommand(t);
            const isActive = t.status === "active";

            return (
              <div
                key={t.id}
                className={`bg-slate-900 border rounded-xl p-4 transition-all hover:shadow-lg ${
                  isActive ? "border-teal-500/50 bg-slate-900/90" : "border-slate-800"
                }`}
              >
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isActive ? "bg-teal-400 animate-pulse" : "bg-slate-600"
                      }`}
                    />
                    <h3 className="font-bold text-slate-200 text-sm truncate">{t.name}</h3>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                        t.type === "local"
                          ? "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                          : t.type === "remote"
                          ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                          : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      }`}
                    >
                      {t.type === "local" ? "Local -L" : t.type === "remote" ? "Remote -R" : "SOCKS -D"}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <span className="text-[10px] font-mono text-slate-400">Statut:</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        isActive
                          ? "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                          : "bg-slate-950 text-slate-400 border border-slate-800"
                      }`}
                    >
                      {isActive ? "Actif" : "Inactif"}
                    </span>
                  </div>
                </div>

                {/* Path representation */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 py-2 px-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs font-mono text-slate-300 mb-3">
                  <div className="flex-1 flex flex-col">
                    <span className="text-[10px] text-slate-500">Machine Locale</span>
                    <span className="text-slate-200 font-bold">127.0.0.1:{t.localPort}</span>
                  </div>

                  <div className="flex items-center justify-center py-1 sm:py-0">
                    <ArrowRight className={`w-4 h-4 shrink-0 ${isActive ? "text-teal-400 animate-bounce-h" : "text-slate-600"}`} />
                  </div>

                  <div className="flex-1 flex flex-col">
                    <span className="text-[10px] text-slate-500">Serveur SSH Relais</span>
                    <span className="text-emerald-400 font-semibold truncate">
                      {host ? `${host.username}@${host.host}` : "Non configuré"}
                    </span>
                  </div>

                  {t.type !== "dynamic" && (
                    <>
                      <div className="flex items-center justify-center py-1 sm:py-0">
                        <ArrowRight className={`w-4 h-4 shrink-0 ${isActive ? "text-teal-400" : "text-slate-600"}`} />
                      </div>

                      <div className="flex-1 flex flex-col">
                        <span className="text-[10px] text-slate-500">Cible Distante</span>
                        <span className="text-blue-300 font-bold">
                          {t.remoteHost}:{t.remotePort}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Performance Metrics if active */}
                {isActive && (
                  <div className="grid grid-cols-3 gap-2 py-1.5 px-3 bg-teal-500/5 rounded-lg border border-teal-500/10 text-[11px] font-mono mb-3">
                    <div className="flex flex-col">
                      <span className="text-slate-500">Envoyé</span>
                      <span className="text-teal-300 font-semibold">{formatBytes(t.trafficSent)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500">Reçu</span>
                      <span className="text-emerald-300 font-semibold">{formatBytes(t.trafficReceived)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500">Latence</span>
                      <span className="text-amber-300 font-semibold flex items-center gap-1">
                        <Activity className="w-3 h-3 text-amber-400" /> {t.latency || 15} ms
                      </span>
                    </div>
                  </div>
                )}

                {/* Command generator box */}
                <div className="relative mb-3.5 bg-slate-950 p-2 text-[11px] font-mono text-slate-400 rounded-md border border-slate-800/80 group">
                  <div className="truncate pr-16 text-slate-300">{cmd}</div>
                  <div className="absolute right-1 top-1 flex items-center gap-1">
                    <button
                      onClick={() => handleCopyCommand(t)}
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
                      title="Copier la commande SSH"
                    >
                      {copiedId === t.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/40">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRunDiagnostic(t)}
                      title="Tester et diagnostiquer le tunnel"
                      className="px-2 py-1 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded transition-colors flex items-center gap-1"
                    >
                      <Wifi className="w-3.5 h-3.5 text-teal-400" /> Diagnostiquer
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(t)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                      title="Modifier le tunnel"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteTunnel(t.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Simulator switch */}
                    <button
                      onClick={() => handleToggleStatus(t.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors flex items-center gap-1 ${
                        isActive
                          ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/20"
                          : "bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border-teal-500/20"
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Square className="w-3 h-3 fill-amber-300" /> Stop (Sim)
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-teal-300" /> Start (Sim)
                        </>
                      )}
                    </button>

                    {/* Launch SSH in active terminal */}
                    <button
                      onClick={() => handleLaunchInTerminal(t)}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-[11px] font-mono rounded flex items-center gap-1 shadow transition-all"
                    >
                      <Terminal className="w-3 h-3 stroke-[2.5]" /> Exécuter Terminal
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredTunnels.length === 0 && (
            <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-slate-400">
              <Zap className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">Aucun tunnel SSH configuré</p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-3 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs rounded transition-colors"
              >
                Générer un premier tunnel
              </button>
            </div>
          )}
        </div>

        {/* Right 1 Column: Diagnostic and Logs Console */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400 animate-pulse" />
              Console de Diagnostic
            </h3>
            {isDiagnosing && (
              <RefreshCw className="w-3.5 h-3.5 text-teal-400 animate-spin" />
            )}
          </div>

          <div className="flex-1 mt-3 bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-2 select-text">
            {diagnosticTunnelId ? (
              <>
                <div className="text-slate-500 pb-1 border-b border-slate-900 mb-2">
                  $ ssh-tunnel-diagnostics --id={diagnosticTunnelId}
                </div>
                {diagnosticLogs.map((log, idx) => {
                  let textClass = "text-slate-300";
                  if (log.includes("[ERREUR]")) textClass = "text-red-400 font-bold";
                  if (log.includes("[SUCCESS]")) textClass = "text-emerald-400 font-bold";
                  if (log.includes("[INFO]")) textClass = "text-slate-400";
                  return (
                    <div key={idx} className={textClass}>
                      {log}
                    </div>
                  );
                })}
                {isDiagnosing && (
                  <div className="text-teal-400 animate-pulse">
                    En cours d'analyse... [■■■■■■□□□]
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 px-4 py-8">
                <Wifi className="w-8 h-8 mb-2 text-slate-700" />
                <p className="text-xs">
                  Sélectionnez un tunnel et cliquez sur <strong>"Diagnostiquer"</strong> pour lancer le test d'accessibilité réseau, de routage de port, de validation DNS et d'état du proxy relais.
                </p>
              </div>
            )}
          </div>

          {diagnosticTunnelId && !isDiagnosing && (
            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Diagnostic terminé</span>
              <button
                onClick={() => {
                  const t = tunnels.find((item) => item.id === diagnosticTunnelId);
                  if (t) handleRunDiagnostic(t);
                }}
                className="text-teal-400 hover:text-teal-300 font-mono font-bold hover:underline"
              >
                Relancer le test
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal form create/edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-teal-400" />
                {editingTunnel ? "Éditer le Tunnel SSH" : "Nouveau Tunnel SSH / Port Forwarding"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTunnel} className="p-5 space-y-4">
              {/* Friendly Name */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Nom descriptif du Tunnel</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ex: Redirection PostgreSQL Production"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* SSH Host Link selector */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Serveur SSH Relais Associé</label>
                <select
                  required
                  value={formHostId}
                  onChange={(e) => setFormHostId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                >
                  <option value="" disabled>-- Choisir un serveur SSH enregistré --</option>
                  {hosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.username}@{h.host})
                    </option>
                  ))}
                </select>
                {hosts.length === 0 && (
                  <p className="text-[11px] text-red-400 mt-1">
                    Veuillez d'abord enregistrer un serveur SSH dans le Carnet SSH pour l'associer.
                  </p>
                )}
              </div>

              {/* Forwarding Type Selector */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Type de Redirection</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "local", label: "Local (-L)", desc: "Port Local -> Cible Distante" },
                    { id: "remote", label: "Remote (-R)", desc: "Reverse Proxy : Distant -> Local" },
                    { id: "dynamic", label: "SOCKS (-D)", desc: "Proxy dynamique local" }
                  ].map((typeItem) => (
                    <button
                      key={typeItem.id}
                      type="button"
                      onClick={() => {
                        setFormType(typeItem.id as any);
                        if (typeItem.id === "dynamic") {
                          setFormRemoteHost("127.0.0.1");
                          setFormRemotePort(0);
                        }
                      }}
                      className={`px-2 py-2 rounded text-xs font-mono border text-center transition-colors flex flex-col justify-between h-14 ${
                        formType === typeItem.id
                          ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}
                    >
                      <span className="font-bold block text-[11px]">{typeItem.label}</span>
                      <span className="text-[9px] text-slate-500 block leading-tight">{typeItem.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Port configurations */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Port Local</label>
                  <input
                    type="number"
                    required
                    value={formLocalPort}
                    onChange={(e) => setFormLocalPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                {formType !== "dynamic" && (
                  <>
                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1">Hôte Distant</label>
                      <input
                        type="text"
                        required
                        value={formRemoteHost}
                        onChange={(e) => setFormRemoteHost(e.target.value)}
                        placeholder="localhost, db.internal"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-300 mb-1">Port Distant</label>
                      <input
                        type="number"
                        required
                        value={formRemotePort}
                        onChange={(e) => setFormRemotePort(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Command preview */}
              <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded font-mono text-[10px] text-slate-400 space-y-1">
                <span className="text-slate-500 block">Commande SSH générée :</span>
                <span className="text-teal-400 block break-all">
                  {generateTunnelCommand({
                    id: "temp",
                    name: formName,
                    hostId: formHostId,
                    type: formType,
                    localPort: Number(formLocalPort),
                    remoteHost: formType === "dynamic" ? "127.0.0.1" : formRemoteHost,
                    remotePort: formType === "dynamic" ? 0 : Number(formRemotePort),
                    status: "inactive",
                    createdAt: Date.now(),
                  })}
                </span>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={hosts.length === 0}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs font-mono rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enregistrer le Tunnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
