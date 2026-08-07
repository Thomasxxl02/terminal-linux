import React, { useState } from "react";
import {
  Server,
  Terminal,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Shield,
  Radio,
  Lock,
  Zap,
  Search,
  Download,
  Upload,
  ShieldAlert,
  ShieldCheck,
  Code
} from "lucide-react";
import { SshHost } from "../types";
import { useSecureStorage } from "../hooks/useSecureStorage";
import { errMsg } from "../lib/errors";
import { SshHostFormModal } from "./SshHostFormModal";
import { Tooltip } from "./Tooltip";
import { ConfirmationModal } from "./ConfirmationModal";

const DEFAULT_SSH_HOSTS: SshHost[] = [
];

const STORAGE_KEY_SSH = "terminal_ssh_hosts";

interface SshHostManagerProps {
  onExecuteInTerminal: (command: string, sessionId?: string) => void;
  onLaunchSshSession: (host: SshHost) => void;
}

export const SshHostManager: React.FC<SshHostManagerProps> = ({
  onExecuteInTerminal,
  onLaunchSshSession,
}) => {
  const { value: hostsValue, setValue: setHosts } =
    useSecureStorage<SshHost[]>(STORAGE_KEY_SSH, DEFAULT_SSH_HOSTS);
  // Pendant le chargement async du keyring, on affiche les hôtes par défaut
  const hosts = hostsValue ?? DEFAULT_SSH_HOSTS;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingHost, setEditingHost] = useState<SshHost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Bulk Import / Export States
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Security Audit Pane State
  const [showSecurityAudit, setShowSecurityAudit] = useState(false);

  // (Les états du formulaire ont été extraits dans SshHostFormModal)

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
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (h: SshHost) => {
    setEditingHost(h);
    setIsModalOpen(true);
  };

  const handleSaveHost = (host: SshHost) => {
    if (editingHost) {
      setHosts(hosts.map((h) => (h.id === editingHost.id ? host : h)));
    } else {
      setHosts([...hosts, host]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteHost = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      setHosts(hosts.filter((h) => h.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    }
  };

  const handleCopyCommand = (h: SshHost) => {
    const cmd = generateSshCommand(h);
    navigator.clipboard.writeText(cmd);
    setCopiedId(h.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePingTest = (h: SshHost) => {
    onExecuteInTerminal(`ping -c 3 ${h.host}`);
  };

  // Run a quick command immediately
  const handleRunQuickCommand = (host: SshHost, cmd: string) => {
    // We launch SSH connection, wait brief interval, then execute the command!
    onLaunchSshSession(host);
    setTimeout(() => {
      onExecuteInTerminal(cmd);
    }, 1200);
  };

  // Export hosts list to clipboard
  const handleExportHosts = () => {
    const jsonStr = JSON.stringify(hosts, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert("Carnet d'hôtes exporté avec succès dans le presse-papiers !");
  };

  // Bulk Import logic
  const handleImportHosts = () => {
    try {
      const parsed = JSON.parse(bulkInput);
      if (Array.isArray(parsed)) {
        // Validate minimally
        const validated: SshHost[] = parsed.map((item: unknown, idx) => {
          const it = item as Record<string, unknown>;
          if (!it.name || !it.host || !it.username) {
            throw new Error(`Élément #${idx + 1} invalide (requis: name, host, username)`);
          }
          return {
            id: (it.id as string) || `ssh_imported_${Date.now()}_${idx}`,
            name: it.name as string,
            host: it.host as string,
            port: Number(it.port) || 22,
            username: it.username as string,
            authType: it.authType === "password" ? "password" : "key",
            privateKeyPath: it.privateKeyPath as string | undefined,
            category: (it.category as string) || "Importé",
            color: (it.color as string) || "#3b82f6",
            description: (it.description as string) || "",
            tunnels: Array.isArray(it.tunnels) ? (it.tunnels as string[]) : [],
            quickCommands: Array.isArray(it.quickCommands) ? (it.quickCommands as SshHost["quickCommands"]) : []
          };
        });

        setHosts([...hosts, ...validated]);
        setBulkInput("");
        setBulkError(null);
        setIsBulkOpen(false);
      } else {
        setBulkError("Le contenu importé doit être un tableau JSON valide.");
      }
    } catch (err) {
      setBulkError(errMsg(err) || "Erreur de syntaxe JSON.");
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 p-6 overflow-y-auto custom-scrollbar">
      {/* Header and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-900">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              Carnet de Connexions SSH & Tunnels Distants
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Gérez vos serveurs distants, vos clés d'authentification et vos redirections de ports (tunnels) pour lancement rapide dans le terminal.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Security Suite toggle button */}
          <button
            onClick={() => setShowSecurityAudit(!showSecurityAudit)}
            className={`px-3 py-2 text-xs font-mono rounded-lg border flex items-center gap-1.5 transition-colors ${
              showSecurityAudit
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Audit Sécurité</span>
          </button>

          {/* Bulk Export/Import Buttons */}
          <button
            onClick={() => {
              setBulkInput("");
              setBulkError(null);
              setIsBulkOpen(true);
            }}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer</span>
          </button>

          <button
            onClick={handleExportHosts}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono rounded-lg shadow-md flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Ajouter un Hôte SSH
          </button>
        </div>
      </div>

      {/* Security Audit Pane */}
      {showSecurityAudit && (
        <div className="mb-6 p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-200 font-bold flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            Audit de Sécurité des Clés & Ports SSH ({hosts.length} hôtes évalués)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
              {hosts.map((h) => {
                const issues: string[] = [];
                if (h.port === 22) issues.push("Port standard 22 détecté (exposé aux attaques de force brute automatique). Recommandé: changer le port.");
                if (h.authType === "password") issues.push("Authentification par mot de passe moins sûre que par clés asymétriques.");
                if (h.authType === "key" && !h.privateKeyPath) issues.push("Clé privée requise mais aucun chemin de clé spécifié.");

                return (
                  <div key={h.id} className="p-2 border-b border-slate-900 last:border-0 flex items-start justify-between gap-3">
                    <div>
                      <span className="font-semibold text-slate-200">{h.name}</span>
                      {issues.length > 0 ? (
                        <div className="space-y-1 mt-1 text-[11px]">
                          {issues.map((issue, idx) => (
                            <span key={idx} className="block text-amber-400">⚠️ {issue}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="block text-emerald-400 text-[11px] mt-0.5">✓ Aucune vulnérabilité triviale détectée !</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
                      issues.length > 1
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : issues.length === 1
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}>
                      {issues.length > 1 ? "Risque Moyen" : issues.length === 1 ? "Attention" : "Sécurisé"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs space-y-2 text-slate-300">
              <h4 className="font-semibold text-slate-200 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Conseils d'Administration SSH Recommandés
              </h4>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                <li>
                  <strong className="text-slate-300">Permissions strictes :</strong> Protégez toujours votre clé privée sur votre machine locale via :
                  <code className="block bg-slate-900 px-2 py-0.5 rounded text-amber-400 font-mono mt-1 text-[11px]">chmod 600 ~/.ssh/id_rsa</code>
                </li>
                <li>
                  <strong className="text-slate-300">Déployer les clés de confiance :</strong> Utilisez <code className="text-emerald-400 font-mono">ssh-copy-id user@host</code> pour copier de manière sécurisée votre clé publique vers le serveur distant.
                </li>
                <li>
                  <strong className="text-slate-300">Désactiver l'accès Root direct :</strong> Modifiez <code className="text-slate-200">/etc/ssh/sshd_config</code> pour configurer <code className="text-amber-400">PermitRootLogin no</code> pour bloquer l'accès super-utilisateur brut.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl p-6">
            <h3 className="font-bold text-slate-100 text-sm mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-400" />
              Importer des hôtes au format JSON
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Collez un tableau d'objets hôtes SSH. Exemple d'attributs requis: "name", "host", "username".
            </p>

            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder='[ { "name": "Mon Serveur", "host": "1.2.3.4", "username": "root" } ]'
              rows={8}
              className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
            />

            {bulkError && (
              <div className="text-red-400 text-xs font-mono mt-2 bg-red-500/10 p-2 rounded border border-red-500/20">
                ⚠️ {bulkError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-800 pt-3">
              <button
                onClick={() => setIsBulkOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleImportHosts}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono rounded-lg shadow"
              >
                Lancer l'Importation
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2 italic">
                    {host.description}
                  </p>
                )}

                {/* Quick Commands Presets Trays */}
                {host.quickCommands && host.quickCommands.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800/60">
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1.5 uppercase tracking-wide">
                      <Code className="w-3 h-3 text-purple-400" /> Raccourcis commandes :
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {host.quickCommands.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => handleRunQuickCommand(host, q.cmd)}
                          title={`Exécuter : ${q.cmd}`}
                          className="text-[10px] font-mono px-2 py-1 rounded bg-purple-500/10 hover:bg-purple-500/25 text-purple-300 border border-purple-500/20 transition-all flex items-center gap-1"
                        >
                          <Terminal className="w-2.5 h-2.5 text-purple-400" />
                          <span>{q.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-4">
                <div className="flex items-center gap-1">
                  <Tooltip content="Copier la commande de connexion SSH" position="top">
                    <button
                      onClick={() => handleCopyCommand(host)}
                      title="Copier la commande de connexion SSH"
                      aria-label="Copier la commande de connexion SSH"
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                    >
                      {copiedId === host.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </Tooltip>

                  <Tooltip content="Tester la connectivité (ping)" position="top">
                    <button
                      onClick={() => handlePingTest(host)}
                      title="Tester la connectivité (ping)"
                      aria-label="Tester la connectivité (ping)"
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                    >
                      <Radio className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>

                  <Tooltip content="Modifier la configuration" position="top">
                    <button
                      onClick={() => handleOpenEditModal(host)}
                      title="Modifier la configuration"
                      aria-label="Modifier la configuration"
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>

                  <Tooltip content="Supprimer de la liste locale" position="top">
                    <button
                      onClick={() => handleDeleteHost(host.id)}
                      title="Supprimer de la liste locale"
                      aria-label="Supprimer de la liste locale"
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
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

      {/* Modal Form for Create / Edit Host (composant extrait) */}
      {isModalOpen && (
        <SshHostFormModal
          editingHost={editingHost}
          onSave={handleSaveHost}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <ConfirmationModal
        isOpen={confirmDeleteId !== null}
        title="Supprimer l'Hôte SSH ?"
        message={`Voulez-vous vraiment supprimer l'hôte SSH "${hosts.find((h) => h.id === confirmDeleteId)?.name || "cet hôte"}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
        type="danger"
      />
    </div>
  );
};
