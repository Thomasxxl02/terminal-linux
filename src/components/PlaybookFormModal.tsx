import React, { useState } from "react";
import { Layers, Clock, PlusCircle, Trash2, BookOpen } from "lucide-react";
import { Playbook, PlaybookStep } from "../types";

const TEMPLATE_SNIPPETS = [
  { title: "Nettoyage Docker", desc: "Supprime conteneurs/volumes orphelins", cmd: "docker system prune -af --volumes", delay: 2 },
  { title: "Mise à jour APT", desc: "Actualise le catalogue Debian/Ubuntu", cmd: "sudo apt-get update && sudo apt-get upgrade -y", delay: 3 },
  { title: "Force Pull Git", desc: "Écrase les modifications locales", cmd: "git fetch origin && git reset --hard origin/main", delay: 2 },
  { title: "Statut Services", desc: "Vérifie Nginx & Systemd", cmd: "systemctl status nginx --no-pager", delay: 1 },
  { title: "Redémarrage App", desc: "Relancer PM2 Node service", cmd: "pm2 restart all || npm run start", delay: 2 },
  { title: "Diagnostic Ports", desc: "Trouve les processus d'écoute", cmd: "lsof -i -P -n | grep LISTEN", delay: 1 }
];

type Snippet = (typeof TEMPLATE_SNIPPETS)[0];

interface PlaybookFormModalProps {
  editingPlaybook: Playbook | null;
  onSave: (data: { id?: string; name: string; description: string; category: Playbook["category"]; steps: PlaybookStep[] }) => void;
  onClose: () => void;
}

/** Formulaire création/édition de playbook (extrait de PlaybookSequencer). */
export const PlaybookFormModal: React.FC<PlaybookFormModalProps> = ({
  editingPlaybook,
  onSave,
  onClose,
}) => {
  const [formName, setFormName] = useState(editingPlaybook?.name || "Nouveau Pipeline d'Automation");
  const [formDescription, setFormDescription] = useState(editingPlaybook?.description || "Description des tâches automatisées...");
  const [formCategory, setFormCategory] = useState<Playbook["category"]>(editingPlaybook?.category || "dev");
  const [formSteps, setFormSteps] = useState<PlaybookStep[]>(
    editingPlaybook ? [...editingPlaybook.steps] : [
      {
        id: "s1",
        title: "Étape 1: Commande initiale",
        command: "echo 'Démarrage du pipeline'",
        stopOnError: true,
        delaySeconds: 1,
      },
    ]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formSteps.length === 0) return;
    onSave({
      id: editingPlaybook?.id,
      name: formName,
      description: formDescription,
      category: formCategory,
      steps: formSteps,
    });
  };

  const handleAppendSnippet = (snippet: Snippet) => {
    setFormSteps((prev) => [
      ...prev,
      {
        id: `s_${Date.now()}_${prev.length}`,
        title: snippet.title,
        command: snippet.cmd,
        stopOnError: true,
        delaySeconds: snippet.delay,
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            {editingPlaybook ? "Éditer le Playbook" : "Créer un Nouveau Playbook"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 h-full">
          <form onSubmit={handleSubmit} className="md:col-span-3 p-6 overflow-y-auto custom-scrollbar space-y-4 border-r border-slate-800 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Nom du Playbook</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Nettoyage et Déploiement"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Notes sur ce pipeline d'automation..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Catégorie</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as Playbook["category"])}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="dev">Développement</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="deploy">Déploiement</option>
                  <option value="security">Sécurité</option>
                  <option value="custom">Personnalisé</option>
                </select>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 uppercase">Temps Estimé</span>
                <span className="text-xs text-teal-400 font-bold flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  {formSteps.reduce((acc, s) => acc + (s.delaySeconds || 1), 0)}s total
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-400 font-bold">Étapes du Pipeline ({formSteps.length})</label>
                <button
                  type="button"
                  onClick={() =>
                    setFormSteps([
                      ...formSteps,
                      {
                        id: `s_${Date.now()}`,
                        title: `Nouvelle Étape #${formSteps.length + 1}`,
                        command: "echo 'Action'",
                        stopOnError: true,
                        delaySeconds: 1,
                      },
                    ])
                  }
                  className="text-teal-400 flex items-center gap-1 hover:underline text-[11px]"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Ajouter Étape brute
                </button>
              </div>

              <div className="space-y-3 max-h-56 overflow-y-auto custom-scrollbar p-1">
                {formSteps.map((step, idx) => (
                  <div key={step.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 relative">
                    <button
                      type="button"
                      onClick={() => setFormSteps(formSteps.filter((s) => s.id !== step.id))}
                      aria-label={`Retirer l'étape ${step.title || idx + 1}`}
                      className="absolute top-2.5 right-2.5 text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500">Titre de l'étape</label>
                        <input
                          type="text"
                          value={step.title}
                          onChange={(e) => {
                            const updated = [...formSteps];
                            updated[idx].title = e.target.value;
                            setFormSteps(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Pause (sec)</label>
                        <input
                          type="number"
                          value={step.delaySeconds}
                          onChange={(e) => {
                            const updated = [...formSteps];
                            updated[idx].delaySeconds = Number(e.target.value);
                            setFormSteps(updated);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500">Commande Shell à lancer</label>
                      <input
                        type="text"
                        value={step.command}
                        onChange={(e) => {
                          const updated = [...formSteps];
                          updated[idx].command = e.target.value;
                          setFormSteps(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
                {formSteps.length === 0 && (
                  <div className="p-4 text-center text-slate-600 italic">Aucune étape. Utilisez le catalogue à droite pour ajouter rapidement !</div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold rounded-lg shadow"
              >
                Enregistrer le Playbook
              </button>
            </div>
          </form>

          <div className="md:col-span-2 p-5 bg-slate-950 flex flex-col overflow-hidden text-xs">
            <h4 className="font-bold text-slate-300 mb-2 uppercase tracking-wide flex items-center gap-1 font-mono shrink-0">
              <BookOpen className="w-4 h-4 text-teal-400" />
              Modèles de Commandes Rapides
            </h4>
            <p className="text-[11px] text-slate-500 mb-4 font-mono shrink-0">
              Cliquez sur un modèle ci-dessous pour l'injecter instantanément comme étape dans votre playbook à gauche.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
              {TEMPLATE_SNIPPETS.map((snippet, idx) => (
                <div
                  key={idx}
                  onClick={() => handleAppendSnippet(snippet)}
                  className="p-3 bg-slate-900 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-900/60 rounded-lg cursor-pointer transition-all text-left font-mono"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-teal-300 text-xs">{snippet.title}</span>
                    <span className="text-[10px] text-slate-500">+{snippet.delay}s delay</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block truncate">{snippet.desc}</span>
                  <code className="text-[10px] text-amber-500 block mt-1.5 truncate bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900">
                    {snippet.cmd}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
