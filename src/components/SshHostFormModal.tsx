import React, { useState } from "react";
import { Key } from "lucide-react";
import { SshHost } from "../types";

interface SshHostFormModalProps {
  editingHost: SshHost | null;
  onSave: (host: SshHost) => void;
  onClose: () => void;
}

/** Formulaire de création / édition d'un hôte SSH (extrait de SshHostManager). */
export const SshHostFormModal: React.FC<SshHostFormModalProps> = ({
  editingHost,
  onSave,
  onClose,
}) => {
  const [formName, setFormName] = useState(editingHost?.name || "");
  const [formHost, setFormHost] = useState(editingHost?.host || "");
  const [formPort, setFormPort] = useState(editingHost?.port || 22);
  const [formUsername, setFormUsername] = useState(editingHost?.username || "root");
  const [formAuthType, setFormAuthType] = useState<"password" | "key">(editingHost?.authType || "key");
  const [formKeyPath, setFormKeyPath] = useState(editingHost?.privateKeyPath || "~/.ssh/id_rsa");
  const [formCategory, setFormCategory] = useState(editingHost?.category || "Production");
  const [formColor, setFormColor] = useState(editingHost?.color || "#10b981");
  const [formDescription, setFormDescription] = useState(editingHost?.description || "");
  const [formTunnels, setFormTunnels] = useState<string[]>(editingHost?.tunnels || []);
  const [tunnelInput, setTunnelInput] = useState("");
  const [formQuickCmds, setFormQuickCmds] = useState(editingHost?.quickCommands || []);
  const [qcNameInput, setQcNameInput] = useState("");
  const [qcCmdInput, setQcCmdInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formHost || !formUsername) return;

    onSave({
      id: editingHost ? editingHost.id : `ssh_${Date.now()}`,
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
      quickCommands: formQuickCmds,
    });
  };

  const handleAddTunnel = () => {
    if (tunnelInput.trim() && !formTunnels.includes(tunnelInput.trim())) {
      setFormTunnels([...formTunnels, tunnelInput.trim()]);
      setTunnelInput("");
    }
  };

  const handleRemoveTunnel = (t: string) => {
    setFormTunnels(formTunnels.filter((item) => item !== t));
  };

  const handleAddQuickCmd = () => {
    if (qcNameInput.trim() && qcCmdInput.trim()) {
      setFormQuickCmds([
        ...formQuickCmds,
        { id: `qc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: qcNameInput.trim(), cmd: qcCmdInput.trim() }
      ]);
      setQcNameInput("");
      setQcCmdInput("");
    }
  };

  const handleRemoveQuickCmd = (id: string) => {
    setFormQuickCmds(formQuickCmds.filter((q) => q.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" />
            {editingHost ? "Éditer l'Hôte SSH" : "Nouveau Serveur SSH"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-mono overflow-y-auto custom-scrollbar flex-1">
          <div>
            <label className="block text-slate-400 mb-1">Nom d'affichage</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="ex: Production Web Server"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-400 mb-1">IP / Nom d'Hôte</label>
              <input
                type="text"
                value={formHost}
                onChange={(e) => setFormHost(e.target.value)}
                placeholder="192.168.1.100 ou mydomain.com"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Port</label>
              <input
                type="number"
                value={formPort}
                onChange={(e) => setFormPort(Number(e.target.value))}
                placeholder="22"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Nom d'utilisateur (Username)</label>
            <input
              type="text"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              placeholder="root"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Mode d'authentification</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormAuthType("key")}
                className={`py-2 px-3 border rounded text-center font-bold ${
                  formAuthType === "key"
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                Clé SSH (id_rsa / id_ed25519)
              </button>
              <button
                type="button"
                onClick={() => setFormAuthType("password")}
                className={`py-2 px-3 border rounded text-center font-bold ${
                  formAuthType === "password"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                Mot de passe
              </button>
            </div>
          </div>

          {formAuthType === "key" && (
            <div>
              <label className="block text-slate-400 mb-1">Chemin de la Clé Privée</label>
              <input
                type="text"
                value={formKeyPath}
                onChange={(e) => setFormKeyPath(e.target.value)}
                placeholder="~/.ssh/id_rsa"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Catégorie</label>
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="Production, Staging, Local..."
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Couleur visuelle</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-10 h-9 bg-slate-950 border border-slate-800 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Description / Notes</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Description optionnelle de cet hôte..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Tunnels de ports intégrés (-L LocalPort:RemoteHost:RemotePort)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tunnelInput}
                onChange={(e) => setTunnelInput(e.target.value)}
                placeholder="Ex: 8080:localhost:80"
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddTunnel}
                className="px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded font-bold"
              >
                Ajouter
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950 rounded border border-slate-800 max-h-24 overflow-y-auto custom-scrollbar">
              {formTunnels.map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-200 flex items-center gap-1.5"
                >
                  <span>-L {t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTunnel(t)}
                    className="text-red-400 hover:text-red-200 font-bold"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {formTunnels.length === 0 && (
                <span className="text-slate-600 text-[10px] italic">Aucun tunnel de port configuré.</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Raccourcis de Commandes Rapides</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                value={qcNameInput}
                onChange={(e) => setQcNameInput(e.target.value)}
                placeholder="Libellé (ex: CPU)"
                className="bg-slate-950 border border-slate-800 rounded px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={qcCmdInput}
                  onChange={(e) => setQcCmdInput(e.target.value)}
                  placeholder="Commande (ex: top -b)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddQuickCmd}
                  className="px-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-slate-950 rounded border border-slate-800 max-h-28 overflow-y-auto custom-scrollbar space-y-1.5">
              {formQuickCmds.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between text-[11px] font-mono bg-slate-900 border border-slate-800 p-1.5 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">{q.name} :</span>
                    <span className="text-slate-400 font-normal line-clamp-1 italic">{q.cmd}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuickCmd(q.id)}
                    className="text-red-400 hover:text-red-200 font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {formQuickCmds.length === 0 && (
                <span className="text-slate-600 text-[10px] italic">Aucune commande rapide configurée.</span>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 shrink-0 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg shadow"
            >
              Enregistrer l'Hôte
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
