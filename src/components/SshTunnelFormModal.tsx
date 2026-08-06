import React, { useState } from "react";
import { Workflow } from "lucide-react";
import { SshHost, SshTunnel } from "../types";

interface SshTunnelFormModalProps {
  editingTunnel: SshTunnel | null;
  hosts: SshHost[];
  onSave: (data: {
    id?: string;
    name: string;
    hostId: string;
    type: "local" | "remote" | "dynamic";
    localPort: number;
    remoteHost: string;
    remotePort: number;
    serverAliveInterval: number;
    exitOnFailure: boolean;
  }) => void;
  onClose: () => void;
}

/** Formulaire création/édition de tunnel SSH (extrait de SshTunnelManager). */
export const SshTunnelFormModal: React.FC<SshTunnelFormModalProps> = ({
  editingTunnel,
  hosts,
  onSave,
  onClose,
}) => {
  const [formName, setFormName] = useState(editingTunnel?.name || "");
  const [formHostId, setFormHostId] = useState(editingTunnel?.hostId || hosts[0]?.id || "");
  const [formType, setFormType] = useState<"local" | "remote" | "dynamic">(editingTunnel?.type || "local");
  const [formLocalPort, setFormLocalPort] = useState<number>(editingTunnel?.localPort || 8080);
  const [formRemoteHost, setFormRemoteHost] = useState(editingTunnel?.remoteHost || "localhost");
  const [formRemotePort, setFormRemotePort] = useState<number>(editingTunnel?.remotePort || 80);
  const [formAliveInterval, setFormAliveInterval] = useState<number>(editingTunnel?.serverAliveInterval || 60);
  const [formExitOnFailure, setFormExitOnFailure] = useState<boolean>(editingTunnel?.exitOnFailure !== false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formHostId) return;
    onSave({
      id: editingTunnel?.id,
      name: formName,
      hostId: formHostId,
      type: formType,
      localPort: Number(formLocalPort),
      remoteHost: formType === "dynamic" ? "127.0.0.1" : formRemoteHost,
      remotePort: formType === "dynamic" ? 0 : Number(formRemotePort),
      serverAliveInterval: Number(formAliveInterval),
      exitOnFailure: formExitOnFailure,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Workflow className="w-4 h-4 text-emerald-400" />
            {editingTunnel ? "Éditer le Tunnel SSH" : "Nouveau Tunnel SSH / Port Forwarding"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-mono overflow-y-auto custom-scrollbar flex-1">
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
              onClick={onClose}
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
  );
};
