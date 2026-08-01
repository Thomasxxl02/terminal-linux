import React, { useState } from "react";
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
  Layers,
  Search,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { SshHost, TerminalSessionInfo } from "../types";
import { useLocalStorage } from "../hooks/useLocalStorage";

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
    id: "ssh-rpi-home",
    name: "Raspberry Pi Cluster Local",
    host: "192.168.1.50",
    port: 22,
    username: "pi",
    authType: "password",
    category: "IoT / Local",
    color: "#f59e0b",
    description: "Nœud de monitoring local & passerelle IoT",
    tunnels: ["9090:localhost:9090"],
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

const STORAGE_KEY_SSH = "terminal_ssh_hosts";

interface SshHostManagerProps {
  onExecuteInTerminal: (command: string, sessionId?: string) => void;
  onLaunchSshSession: (host: SshHost) => void;
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
}

export const SshHostManager: React.FC<SshHostManagerProps> = ({
  onExecuteInTerminal,
  onLaunchSshSession,
  sessions,
  activeSessionId,
}) => {
  const [hosts, setHosts] = useLocalStorage<SshHost[]>(STORAGE_KEY_SSH, DEFAULT_SSH_HOSTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingHost, setEditingHost] = useState<SshHost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formHost, setFormHost] = useState("");
  const [formPort, setFormPort] = useState(22);
  const [formUsername, setFormUsername] = useState("root");
  const [formAuthType, setFormAuthType] = useState<"password" | "key">("key");
  const [formKeyPath, setFormKeyPath] = useState("~/.ssh/id_rsa");
  const [formCategory, setFormCategory] = useState("Production");
  const [formColor, setFormColor] = useState("#10b981");
  const [formDescription, setFormDescription] = useState("");
  const [formTunnels, setFormTunnels] = useState<string[]>([]);
  const [tunnelInput, setTunnelInput] = useState("");

  const categories = ["all", ...Array.from(new Set(hosts.map((h) => h.category || "Général")))];

  const filteredHosts = hosts.filter((h) => {
    const matchesSearch =
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || h.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const generateSshCommand = (h: SshHost): string => {
    let cmd = `ssh `;
    if (h.port !== 22) {
      cmd += `-p ${h.port} `;
    }
    if (h.authType === "key" && h.privateKeyPath) {
      cmd += `-i "${h.privateKeyPath}" `;
    }
    if (h.tunnels && h.tunnels.length > 0) {
      h.tunnels.forEach((t) => {
        cmd += `-L ${t} `;
      });
    }
    cmd += `${h.username}@${h.host}`;
    return cmd;
  };

  const handleOpenCreateModal = () => {
    setEditingHost(null);
    setFormName("");
    setFormHost("");
    setFormPort(22);
    setFormUsername("root");
    setFormAuthType("key");
    setFormKeyPath("~/.ssh/id_rsa");
    setFormCategory("Production");
    setFormColor("#10b981");
    setFormDescription("");
    setFormTunnels([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (h: SshHost) => {
    setEditingHost(h);
    setFormName(h.name);
    setFormHost(h.host);
    setFormPort(h.port);
    setFormUsername(h.username);
    setFormAuthType(h.authType);
    setFormKeyPath(h.privateKeyPath || "~/.ssh/id_rsa");
    setFormCategory(h.category || "Général");
    setFormColor(h.color || "#10b981");
    setFormDescription(h.description || "");
    setFormTunnels(h.tunnels || []);
    setIsModalOpen(true);
  };

  const handleSaveHost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formHost || !formUsername) return;

    if (editingHost) {
      const updated = hosts.map((h) =>
        h.id === editingHost.id
          ? {
              ...h,
              name: formName,
              host: formHost,
              port: Number(formPort),
              username: formUsername,
              authType: formAuthType,
              privateKeyPath: formAuthType === "key" ? formKeyPath : undefined,
              category: formCategory,
              color: formColor,
              description: formDescription,
              tunnels: formTunnels,
            }
          : h
      );
      setHosts(updated);
    } else {
      const newHost: SshHost = {
        id: `ssh_${Date.now()}`,
        name: formName,
        host: formHost,
        port: Number(formPort),
        username: formUsername,
        authType: formAuthType,
        privateKeyPath: formAuthType === "key" ? formKeyPath : undefined,
        category: formCategory,
        color: formColor,
        description: formDescription,
        tunnels: formTunnels,
      };
      setHosts([...hosts, newHost]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteHost = (id: string) => {
    setHosts(hosts.filter((h) => h.id !== id));
  };

  const handleAddTunnel = () => {
    if (!tunnelInput.trim()) return;
    setFormTunnels([...formTunnels, tunnelInput.trim()]);
    setTunnelInput("");
  };

  const handleRemoveTunnel = (index: number) => {
    setFormTunnels(formTunnels.filter((_, i) => i !== index));
  };

  const handleCopyCommand = (h: SshHost) => {
    const cmd = generateSshCommand(h);
    navigator.clipboard.writeText(cmd);
    setCopiedId(h.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePingTest = (h: SshHost) => {
    const cmd = `echo "[SSH MANAGER] Test de connectivité vers ${h.host}..." && ping -c 3 ${h.host}`;
    onExecuteInTerminal(cmd, activeSessionId || undefined);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto custom-scrollbar p-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Key className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              Carnet de Connexions SSH & Tunnels Distants
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Gérez vos serveurs distants, vos clés d'authentification et vos redirections de ports (tunnels) pour lancement rapide dans le terminal.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono rounded-lg shadow-md flex items-center gap-2 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Ajouter un Hôte SSH
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher nom, IP, user..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* Categories Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              {cat === "all" ? "Tous les hôtes" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of SSH Hosts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {filteredHosts.map((host) => {
          const sshCmd = generateSshCommand(host);
          return (
            <div
              key={host.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all hover:shadow-lg group"
            >
              <div>
                {/* Host Title & Category */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: host.color || "#10b981" }}
                    />
                    <h3 className="font-bold text-slate-200 text-sm truncate">{host.name}</h3>
                  </div>
                  {host.category && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 shrink-0">
                      {host.category}
                    </span>
                  )}
                </div>

                {/* Host Connection Info */}
                <div className="space-y-1.5 my-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-emerald-400" /> Cible :
                    </span>
                    <span className="text-emerald-300 font-bold">
                      {host.username}@{host.host}:{host.port}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-400" /> Auth :
                    </span>
                    <span className="text-slate-300 text-[11px]">
                      {host.authType === "key" ? `Clé (${host.privateKeyPath?.split("/").pop()})` : "Mot de passe"}
                    </span>
                  </div>

                  {host.tunnels && host.tunnels.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1 mb-1">
                        <Zap className="w-3 h-3 text-amber-400" /> Tunnels SSH actifs :
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {host.tunnels.map((t, idx) => (
                          <span
                            key={idx}
                            className="bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded text-[10px] border border-amber-500/20"
                          >
                            -L {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {host.description && (
                  <p className="text-xs text-slate-400 mb-4 line-clamp-2 italic">
                    {host.description}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyCommand(host)}
                    title="Copier la commande SSH"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                  >
                    {copiedId === host.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handlePingTest(host)}
                    title="Tester la connectivité (ping)"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(host)}
                    title="Modifier cet hôte"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteHost(host.id)}
                    title="Supprimer"
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Primary Launch SSH Button */}
                <button
                  onClick={() => onLaunchSshSession(host)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono rounded-lg flex items-center gap-1.5 shadow transition-all"
                >
                  <Terminal className="w-3.5 h-3.5 stroke-[2.5]" /> Connecter SSH
                </button>
              </div>
            </div>
          );
        })}

        {filteredHosts.length === 0 && (
          <div className="col-span-full p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-slate-400">
            <Server className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-medium">Aucun hôte SSH correspondant</p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded transition-colors"
            >
              Créer un nouvel hôte SSH
            </button>
          </div>
        )}
      </div>

      {/* Modal Form for Create / Edit Host */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                {editingHost ? "Éditer l'Hôte SSH" : "Nouveau Serveur SSH"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHost} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Nom du Serveur</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ex: Production Web Server"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-mono text-slate-300 mb-1">Hôte (IP ou Domaine)</label>
                  <input
                    type="text"
                    required
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="192.168.1.100 ou mydomain.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={formPort}
                    onChange={(e) => setFormPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Utilisateur (SSH User)</label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="root, ubuntu, etc."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Catégorie</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Production, Staging, etc."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Authentication Type */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Méthode d'Authentification</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAuthType("key")}
                    className={`px-3 py-1.5 rounded text-xs font-mono border text-center transition-colors ${
                      formAuthType === "key"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    🔑 Clé Privée (RSA / ED25519)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAuthType("password")}
                    className={`px-3 py-1.5 rounded text-xs font-mono border text-center transition-colors ${
                      formAuthType === "password"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    🔒 Mot de passe (Invite PTY)
                  </button>
                </div>
              </div>

              {formAuthType === "key" && (
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Chemin vers la Clé Privée</label>
                  <input
                    type="text"
                    value={formKeyPath}
                    onChange={(e) => setFormKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_rsa ou /path/to/key.pem"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Tunnels SSH (-L) */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Redirections de Ports (Tunnels SSH -L)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tunnelInput}
                    onChange={(e) => setTunnelInput(e.target.value)}
                    placeholder="ex: 8080:localhost:80"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTunnel}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded"
                  >
                    Ajouter
                  </button>
                </div>

                {formTunnels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formTunnels.map((t, idx) => (
                      <span
                        key={idx}
                        className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded text-xs border border-amber-500/20 font-mono flex items-center gap-1.5"
                      >
                        -L {t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTunnel(idx)}
                          className="hover:text-red-400"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Description / Notes</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Notes sur le serveur ou son rôle..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono rounded"
                >
                  Enregistrer l'Hôte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
