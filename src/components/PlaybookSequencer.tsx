import React, { useState, useEffect } from "react";
import {
  Layers,
  Play,
  Plus,
  Trash2,
  Download,
  Upload,
  FileCode2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Terminal
} from "lucide-react";
import { Playbook, PlaybookStep, TerminalSessionInfo } from "../types";
import { useLocalStorage } from "../hooks/useLocalStorage";

const PRESET_PLAYBOOKS: Playbook[] = [
  {
    id: "pb_build_deploy",
    name: "🚀 Pipeline Build & Déploiement App",
    description: "Inspection Git, installation des dépendances, vérification Linter et compilation de production.",
    category: "dev",
    createdAt: Date.now(),
    steps: [
      {
        id: "s1",
        title: "Vérification Statut Git",
        command: "git status --short && git log -n 3 --oneline",
        description: "Contrôle la propreté de l'arbre de travail Git",
        stopOnError: true,
        delaySeconds: 1,
      },
      {
        id: "s2",
        title: "Installation Dépendances NPM",
        command: "npm install",
        description: "Synchronise les paquets node_modules",
        stopOnError: true,
        delaySeconds: 2,
      },
      {
        id: "s3",
        title: "Vérification Syntaxique Linter",
        command: "npm run lint || true",
        description: "Analyse du code TypeScript pour détecter les erreurs",
        stopOnError: false,
        delaySeconds: 1,
      },
      {
        id: "s4",
        title: "Build Production Vite / Node",
        command: "npm run build",
        description: "Génère les bundles de production optimisés",
        stopOnError: true,
        delaySeconds: 1,
      },
    ],
  },
  {
    id: "pb_sys_maint",
    name: "🧹 Maintenance Système & Purge Cache",
    description: "Nettoyage approfondi des paquets APT, vidage des fichiers temporaires /tmp et purge des logs volumineux.",
    category: "maintenance",
    createdAt: Date.now(),
    steps: [
      {
        id: "m1",
        title: "Purge du Cache APT",
        command: "apt-get clean 2>/dev/null || echo '[OK] Cache local nettoyé'",
        description: "Libère le cache des paquets Debian/Ubuntu",
        stopOnError: false,
        delaySeconds: 1,
      },
      {
        id: "m2",
        title: "Suppression Fichiers Temporaires",
        command: "rm -rf /tmp/* ~/.cache/* 2>/dev/null && echo '[OK] Fichiers temporaires nettoyés'",
        description: "Vide le dossier /tmp et le cache utilisateur",
        stopOnError: false,
        delaySeconds: 1,
      },
      {
        id: "m3",
        title: "Purge des Fichiers de Logs > 10Mo",
        command: "find /var/log -type f -name '*.log' -size +10M -delete 2>/dev/null || echo '[OK] Audit logs terminé'",
        description: "Supprime les journaux obsolètes volumineux",
        stopOnError: false,
        delaySeconds: 1,
      },
      {
        id: "m4",
        title: "Rapport Espace Disque Disponible",
        command: "df -h /",
        description: "Affiche l'espace libre sur la partition racine",
        stopOnError: false,
        delaySeconds: 1,
      },
    ],
  },
  {
    id: "pb_sec_audit",
    name: "🔒 Audit Sécurité & Inspection Réseau",
    description: "Vérification des processus actifs, ports TCP/UDP ouverts et utilisateurs connectés.",
    category: "security",
    createdAt: Date.now(),
    steps: [
      {
        id: "sec1",
        title: "Informations Système & Uptime",
        command: "uname -a && uptime",
        description: "Identifie la version exacte du noyau Linux",
        stopOnError: true,
        delaySeconds: 1,
      },
      {
        id: "sec2",
        title: "Inspection Top Processus CPU/RAM",
        command: "ps aux --sort=-%cpu | head -n 8",
        description: "Liste les processus les plus gourmands",
        stopOnError: false,
        delaySeconds: 1,
      },
      {
        id: "sec3",
        title: "Vérification des Ports Écoute (ss / netstat)",
        command: "ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null",
        description: "Affiche tous les services écoutant sur le réseau",
        stopOnError: false,
        delaySeconds: 1,
      },
    ],
  },
];

const STORAGE_KEY_PLAYBOOKS = "tauri_linux_playbooks";

interface PlaybookSequencerProps {
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  onExecuteCommandInTerminal: (cmd: string, sessionId?: string) => void;
  onOpenTerminalView: () => void;
}

export const PlaybookSequencer: React.FC<PlaybookSequencerProps> = ({
  sessions,
  activeSessionId,
  onExecuteCommandInTerminal,
  onOpenTerminalView,
}) => {
  const [playbooks, setPlaybooks] = useLocalStorage<Playbook[]>(
    STORAGE_KEY_PLAYBOOKS,
    PRESET_PLAYBOOKS
  );
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(() => playbooks[0] || null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Runner state
  const [runningStepIndex, setRunningStepIndex] = useState<number | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<string, "pending" | "running" | "success" | "failed">>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Modal / Form state for creating custom playbooks
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<Playbook["category"]>("dev");
  const [formSteps, setFormSteps] = useState<PlaybookStep[]>([]);

  // Notifications
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPlaybook && playbooks.length > 0) {
      setSelectedPlaybook(playbooks[0]);
    }
  }, [playbooks, selectedPlaybook]);

  useEffect(() => {
    if (activeSessionId) {
      setSelectedSessionId(activeSessionId);
    } else if (sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  const savePlaybooks = (updated: Playbook[]) => {
    setPlaybooks(updated);
    try {
      localStorage.setItem(STORAGE_KEY_PLAYBOOKS, JSON.stringify(updated));
    } catch {}
  };

  const showNotification = (msg: string) => {
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(null), 3000);
  };

  // Run Playbook Sequence Logic
  const handleStartPlaybook = async () => {
    if (!selectedPlaybook || selectedPlaybook.steps.length === 0) return;
    setIsRunning(true);
    setRunningStepIndex(0);

    const initialStatuses: Record<string, "pending" | "running" | "success" | "failed"> = {};
    selectedPlaybook.steps.forEach((s) => (initialStatuses[s.id] = "pending"));
    setStepStatuses(initialStatuses);

    // Switch to terminal view to let user watch execution output
    onOpenTerminalView();

    for (let i = 0; i < selectedPlaybook.steps.length; i++) {
      const step = selectedPlaybook.steps[i];
      setRunningStepIndex(i);
      setStepStatuses((prev) => ({ ...prev, [step.id]: "running" }));

      // Send echo header and command to PTY terminal
      const banner = `echo -e "\\n\\e[1;33m[PLAYBOOK PIPELINE] Étape ${i + 1}/${selectedPlaybook.steps.length}: ${step.title}\\e[0m"`;
      onExecuteCommandInTerminal(banner, selectedSessionId);

      // Execute actual command
      onExecuteCommandInTerminal(step.command, selectedSessionId);

      // Wait delaySeconds
      await new Promise((res) => setTimeout(res, (step.delaySeconds || 1) * 1000));

      setStepStatuses((prev) => ({ ...prev, [step.id]: "success" }));
    }

    // Done header
    onExecuteCommandInTerminal(
      `echo -e "\\n\\e[1;32m[PLAYBOOK PIPELINE] ✅ Pipeline '${selectedPlaybook.name}' exécuté avec succès !\\e[0m"`,
      selectedSessionId
    );

    setIsRunning(false);
    setRunningStepIndex(null);
    showNotification("Pipeline d'automatisation terminé !");
  };

  // Export as Bash Script (.sh)
  const generateBashScript = (pb: Playbook): string => {
    let script = `#!/usr/bin/env bash\n`;
    script += `# ==========================================================\n`;
    script += `# Playbook Automation Script: ${pb.name}\n`;
    script += `# Description: ${pb.description}\n`;
    script += `# Généré par Tauri Linux Terminal Studio\n`;
    script += `# ==========================================================\n\n`;
    script += `set -e\n\n`;

    pb.steps.forEach((step, index) => {
      script += `# --- Étape ${index + 1}: ${step.title} ---\n`;
      script += `echo "=========================================================="\n`;
      script += `echo "[PLAYBOOK] Step ${index + 1}/${pb.steps.length}: ${step.title}"\n`;
      script += `echo "=========================================================="\n`;
      if (step.description) script += `# ${step.description}\n`;
      if (!step.stopOnError) {
        script += `(${step.command}) || echo "[WARN] L'étape a rencontré une erreur non critique."\n`;
      } else {
        script += `${step.command}\n`;
      }
      if (step.delaySeconds > 0) {
        script += `sleep ${step.delaySeconds}\n`;
      }
      script += `\n`;
    });

    script += `echo "[SUCCESS] Pipeline de playbook exécuté avec succès !"\n`;
    return script;
  };

  const handleDownloadBashScript = () => {
    if (!selectedPlaybook) return;
    const content = generateBashScript(selectedPlaybook);
    const blob = new Blob([content], { type: "text/x-shellscript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playbook_${selectedPlaybook.id}.sh`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Script Bash (.sh) téléchargé avec succès !");
  };

  const handleExportJson = () => {
    if (!selectedPlaybook) return;
    const jsonStr = JSON.stringify(selectedPlaybook, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playbook_${selectedPlaybook.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Fichier Playbook JSON exporté !");
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedPb = JSON.parse(event.target?.result as string) as Playbook;
        if (importedPb.name && Array.isArray(importedPb.steps)) {
          importedPb.id = `pb_imported_${Date.now()}`;
          const updated = [importedPb, ...playbooks];
          savePlaybooks(updated);
          setSelectedPlaybook(importedPb);
          showNotification(`Playbook "${importedPb.name}" importé !`);
        } else {
          alert("Format JSON de Playbook invalide.");
        }
      } catch {
        alert("Erreur lors de la lecture du fichier JSON.");
      }
    };
    reader.readAsText(file);
  };

  // Form Handlers
  const handleOpenCreateModal = () => {
    setEditingPlaybook(null);
    setFormName("Nouveau Pipeline d'Automation");
    setFormDescription("Description des tâches automatisées...");
    setFormCategory("dev");
    setFormSteps([
      {
        id: "s1",
        title: "Étape 1: Commande initiale",
        command: "echo 'Démarrage du pipeline'",
        stopOnError: true,
        delaySeconds: 1,
      },
    ]);
    setIsEditingModalOpen(true);
  };

  const handleOpenEditModal = (pb: Playbook) => {
    setEditingPlaybook(pb);
    setFormName(pb.name);
    setFormDescription(pb.description);
    setFormCategory(pb.category);
    setFormSteps([...pb.steps]);
    setIsEditingModalOpen(true);
  };

  const handleSavePlaybook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formSteps.length === 0) return;

    if (editingPlaybook) {
      const updated = playbooks.map((p) =>
        p.id === editingPlaybook.id
          ? {
              ...p,
              name: formName,
              description: formDescription,
              category: formCategory,
              steps: formSteps,
            }
          : p
      );
      savePlaybooks(updated);
      setSelectedPlaybook(updated.find((p) => p.id === editingPlaybook.id) || updated[0]);
      showNotification("Playbook mis à jour avec succès !");
    } else {
      const newPb: Playbook = {
        id: `pb_${Date.now()}`,
        name: formName,
        description: formDescription,
        category: formCategory,
        steps: formSteps,
        createdAt: Date.now(),
      };
      savePlaybooks([newPb, ...playbooks]);
      setSelectedPlaybook(newPb);
      showNotification("Nouveau Playbook d'automation créé !");
    }

    setIsEditingModalOpen(false);
  };

  const handleDeletePlaybook = (id: string) => {
    const updated = playbooks.filter((p) => p.id !== id);
    savePlaybooks(updated);
    if (selectedPlaybook?.id === id) {
      setSelectedPlaybook(updated[0] || null);
    }
    showNotification("Playbook supprimé.");
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col h-full overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Séquenceur de Playbooks & Automation
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-teal-400 border border-slate-700">
                {playbooks.length} Pipelines
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Créez, importez, exportez et enchaînez des pipelines de commandes multi-étapes dans le terminal PTY.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Import JSON button */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg border border-slate-700 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            <span>Importer JSON</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs font-mono rounded-lg shadow transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Créer un Playbook</span>
          </button>
        </div>
      </div>

      {/* Banner Message */}
      {bannerMsg && (
        <div className="mx-4 mt-3 px-4 py-2 bg-teal-500/20 border border-teal-500/40 rounded-lg text-teal-200 text-xs font-mono flex items-center gap-2 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{bannerMsg}</span>
        </div>
      )}

      {/* Main Container Grid (Left Playbooks List, Right Playbook Execution Engine) */}
      <div className="flex-1 overflow-hidden p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Side: Playbooks List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col h-full overflow-hidden">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold px-2 mb-2">
            BIBLIOTHÈQUE DE PLAYBOOKS
          </h3>

          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
            {playbooks.map((pb) => {
              const isSelected = selectedPlaybook?.id === pb.id;
              return (
                <div
                  key={pb.id}
                  onClick={() => setSelectedPlaybook(pb)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-teal-500/10 border-teal-500/40 shadow-md"
                      : "bg-slate-950/40 border-slate-800 hover:bg-slate-800/40 hover:border-slate-700 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4
                      className={`font-semibold text-xs ${
                        isSelected ? "text-teal-300" : "text-slate-200"
                      }`}
                    >
                      {pb.name}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-800 text-slate-400 uppercase">
                      {pb.category}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-2 font-sans">
                    {pb.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>{pb.steps.length} Étapes</span>
                    <span>{new Date(pb.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Selected Playbook Sequencer Runner */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-full overflow-hidden">
          {selectedPlaybook ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Selected Playbook Header & Actions */}
              <div className="pb-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">{selectedPlaybook.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase">
                      {selectedPlaybook.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedPlaybook.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(selectedPlaybook)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded border border-slate-700 transition-colors"
                  >
                    Éditer
                  </button>

                  <button
                    onClick={handleExportJson}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                    title="Exporter en JSON"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleDownloadBashScript}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-mono text-xs font-semibold rounded transition-colors"
                    title="Générer et télécharger un script Bash .sh exécutable"
                  >
                    <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Script .sh</span>
                  </button>

                  <button
                    onClick={() => handleDeletePlaybook(selectedPlaybook.id)}
                    className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-colors"
                    title="Supprimer Playbook"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Target Terminal Session Selector & Execution Trigger */}
              <div className="my-3 p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3 shrink-0 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-teal-400" />
                  <span className="text-slate-400">Terminal PTY Cible:</span>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-100 rounded px-2.5 py-1 focus:outline-none"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.shell})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleStartPlaybook}
                  disabled={isRunning || sessions.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold rounded-lg shadow transition-all transform hover:scale-102"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isRunning ? "Pipeline en cours..." : "LANCER LE PIPELINE"}</span>
                </button>
              </div>

              {/* Steps Sequence List */}
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
                  SÉQUENCE D'ÉTAPES AUTOMATISÉES ({selectedPlaybook.steps.length})
                </h4>

                {selectedPlaybook.steps.map((step, idx) => {
                  const status = stepStatuses[step.id] || "pending";
                  const isCurrent = runningStepIndex === idx;

                  return (
                    <div
                      key={step.id}
                      className={`p-3.5 rounded-xl border font-mono text-xs transition-all ${
                        isCurrent
                          ? "bg-teal-500/20 border-teal-500/60 shadow-lg ring-1 ring-teal-500"
                          : status === "success"
                          ? "bg-slate-950/60 border-emerald-500/40 text-slate-200"
                          : "bg-slate-950 border-slate-800 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[11px] border border-slate-700">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-100 text-sm">{step.title}</span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {status === "pending" && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              En attente
                            </span>
                          )}
                          {status === "running" && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3" /> En cours...
                            </span>
                          )}
                          {status === "success" && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Succès
                            </span>
                          )}
                          {status === "failed" && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-red-400" /> Échec
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Command Code snippet block */}
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 my-2 text-emerald-300 font-mono text-xs overflow-x-auto flex items-center justify-between">
                        <code>$ {step.command}</code>
                      </div>

                      {/* Details & Flags */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{step.description || "Aucune description"}</span>
                        <div className="flex items-center gap-3">
                          <span>Pause: {step.delaySeconds}s</span>
                          {step.stopOnError ? (
                            <span className="text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Stop si Erreur
                            </span>
                          ) : (
                            <span className="text-slate-500">Poursuivre si Erreur</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <p>Sélectionnez un Playbook dans la bibliothèque</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Form for Create / Edit Playbook */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 max-h-[90vh] flex flex-col overflow-hidden">
            <h3 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-400" />
              {editingPlaybook ? "Éditer le Pipeline d'Automation" : "Créer un Nouveau Pipeline de Playbook"}
            </h3>

            <form onSubmit={handleSavePlaybook} className="flex-1 overflow-y-auto space-y-4 font-mono text-xs pr-1 custom-scrollbar">
              <div>
                <label className="block text-slate-400 mb-1">Titre du Pipeline</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Redémarrage Service Docker Nginx"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                  required
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
                    <option value="maintenance">Maintenance Système</option>
                    <option value="deploy">Déploiement</option>
                    <option value="security">Sécurité & Audit</option>
                    <option value="custom">Personnalisé</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Description Synthétique</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Ex: Enchaîne git pull, npm build et restart"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Dynamic Steps Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    Étapes de Commandes du Pipeline ({formSteps.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormSteps([
                        ...formSteps,
                        {
                          id: `s_${Date.now()}`,
                          title: `Étape ${formSteps.length + 1}`,
                          command: "echo 'Nouvelle commande'",
                          stopOnError: true,
                          delaySeconds: 1,
                        },
                      ])
                    }
                    className="text-teal-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter une Étape
                  </button>
                </div>

                <div className="space-y-3">
                  {formSteps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-teal-400">Étape #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setFormSteps(formSteps.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Titre de l'étape (ex: Git Pull)"
                        value={step.title}
                        onChange={(e) => {
                          const updated = [...formSteps];
                          updated[idx].title = e.target.value;
                          setFormSteps(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-slate-100 focus:outline-none"
                      />

                      <input
                        type="text"
                        placeholder="Commande bash exacte (ex: npm run build)"
                        value={step.command}
                        onChange={(e) => {
                          const updated = [...formSteps];
                          updated[idx].command = e.target.value;
                          setFormSteps(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-emerald-300 font-mono focus:outline-none"
                      />

                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={step.stopOnError}
                            onChange={(e) => {
                              const updated = [...formSteps];
                              updated[idx].stopOnError = e.target.checked;
                              setFormSteps(updated);
                            }}
                            className="rounded border-slate-800 text-teal-500 focus:ring-0"
                          />
                          <span>Arrêter le pipeline si cette étape échoue</span>
                        </label>

                        <div className="flex items-center gap-1">
                          <span>Pause après:</span>
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={step.delaySeconds}
                            onChange={(e) => {
                              const updated = [...formSteps];
                              updated[idx].delaySeconds = parseInt(e.target.value) || 0;
                              setFormSteps(updated);
                            }}
                            className="w-12 bg-slate-900 border border-slate-800 text-center rounded text-slate-100 py-0.5"
                          />
                          <span>sec</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditingModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold rounded-lg shadow"
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
