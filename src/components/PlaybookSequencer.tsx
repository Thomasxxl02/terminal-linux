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
  Terminal,
  Activity,
  Award,
  BookOpen,
  PlusCircle,
  BarChart3,
  ChevronRight,
  Sparkles,
  Zap,
  Check,
  Edit2
} from "lucide-react";
import { Playbook, PlaybookStep, TerminalSessionInfo } from "../types";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useSecureStorage } from "../hooks/useSecureStorage";
import { PlaybookFormModal } from "./PlaybookFormModal";
import { PlaybookStepsView } from "./PlaybookStepsView";

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

// Preconfigured Snippet Library for Fast Appends
const STORAGE_KEY_PLAYBOOKS = "tauri_linux_playbooks";
const STORAGE_KEY_HISTORY = "tauri_linux_playbook_history";

interface PlaybookHistoryItem {
  id: string;
  playbookId: string;
  playbookName: string;
  timestamp: number;
  durationSeconds: number;
  status: "success" | "failed";
}

interface PlaybookSequencerProps {
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  onExecuteCommandInTerminal: (cmd: string, sessionId?: string) => void;
  onOpenTerminalView: () => void;
  /** S'abonne à la sortie brute du PTY (pour détecter les codes de sortie). */
  subscribeOutput?: (fn: (data: string) => void) => () => void;
}

export const PlaybookSequencer: React.FC<PlaybookSequencerProps> = ({
  sessions = [],
  activeSessionId = null,
  onExecuteCommandInTerminal,
  onOpenTerminalView,
  subscribeOutput,
}) => {
  // Playbooks = commandes shell exécutables (peuvent contenir des secrets)
  // → stockage sécurisé (keyring OS en Tauri, localStorage clair en web)
  const { value: playbooks, setValue: setPlaybooks } = useSecureStorage<Playbook[]>(
    STORAGE_KEY_PLAYBOOKS,
    PRESET_PLAYBOOKS
  );
  const safePlaybooks = playbooks ?? PRESET_PLAYBOOKS;
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // History tracking local persistence
  const [historyList, setHistoryList] = useLocalStorage<PlaybookHistoryItem[]>(
    STORAGE_KEY_HISTORY,
    [
      { id: "h1", playbookId: "pb_build_deploy", playbookName: "🚀 Pipeline Build & Déploiement App", timestamp: Date.now() - 3600000 * 2, durationSeconds: 6, status: "success" },
      { id: "h2", playbookId: "pb_sys_maint", playbookName: "🧹 Maintenance Système & Purge Cache", timestamp: Date.now() - 3600000 * 5, durationSeconds: 4, status: "success" },
      { id: "h3", playbookId: "pb_sec_audit", playbookName: "🔒 Audit Sécurité & Inspection Réseau", timestamp: Date.now() - 3600000 * 12, durationSeconds: 3, status: "failed" }
    ]
  );

  // Runner state
  const [runningStepIndex, setRunningStepIndex] = useState<number | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<string, "pending" | "running" | "success" | "failed">>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Modal / Form state for creating custom playbooks
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  // (formName/formDescription/formCategory/formSteps extraits dans PlaybookFormModal)

  // Notifications
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Sélection par défaut : premier playbook une fois chargé
  useEffect(() => {
    if (!selectedPlaybook && safePlaybooks.length > 0) {
      setSelectedPlaybook(safePlaybooks[0]);
    }
  }, [safePlaybooks, selectedPlaybook]);

  useEffect(() => {
    if (activeSessionId) {
      setSelectedSessionId(activeSessionId);
    } else if (sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  const savePlaybooks = (updated: Playbook[]) => {
    // useSecureStorage persiste automatiquement (keyring OS en Tauri)
    setPlaybooks(updated);
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

    const startTime = Date.now();
    let isPbSuccess = true;
    let failedStepTitle: string | null = null;

    // Marqueur de code de sortie injecté après chaque commande : le
    // séquenceur observe la sortie du PTY pour connaître le résultat RÉEL
    // de l'étape (exit code du shell), au lieu de supposer le succès.
    const EXIT_MARKER = "__PB_EXIT_";
    const waitForStepExit = (command: string, delaySeconds: number): Promise<number | null> => {
      return new Promise((resolve) => {
        if (!subscribeOutput) {
          // Pas de canal d'observation : on garde le comportement hérité
          // (délai fixe, résultat inconnu) — jamais de faux échec.
          setTimeout(() => resolve(null), delaySeconds * 1000);
          return;
        }
        let buffer = "";
        let done = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const finish = (code: number | null) => {
          if (done) return;
          done = true;
          if (timer) clearTimeout(timer);
          resolve(code);
        };

        const unsub = subscribeOutput((data) => {
          if (done) return;
          buffer += data;
          const match = buffer.match(new RegExp(EXIT_MARKER + "(\\d+)"));
          if (match) {
            unsub();
            finish(parseInt(match[1], 10));
          }
        });

        // Commande suivie du marqueur de sortie : `cmd; echo __PB_EXIT_$?`
        onExecuteCommandInTerminal(`${command}; echo ${EXIT_MARKER}$?`, selectedSessionId);

        // Timeout de sécurité : une commande bloquée (apt interactif…)
        // ne doit pas figer le séquenceur indéfiniment (120 s).
        timer = setTimeout(() => {
          unsub();
          finish(null);
        }, 120_000);
      });
    };

    for (let i = 0; i < selectedPlaybook.steps.length; i++) {
      const step = selectedPlaybook.steps[i];
      setRunningStepIndex(i);
      setStepStatuses((prev) => ({ ...prev, [step.id]: "running" }));

      // Send echo header and command to PTY terminal
      const banner = `echo -e "\\n\\e[1;33m[PLAYBOOK PIPELINE] Étape ${i + 1}/${selectedPlaybook.steps.length}: ${step.title}\\e[0m"`;
      onExecuteCommandInTerminal(banner, selectedSessionId);

      // Exécution réelle + attente du code de sortie
      const exitCode = await waitForStepExit(step.command, step.delaySeconds || 1);

      if (exitCode !== null && exitCode !== 0) {
        // L'étape a ÉCHOUÉ (code de sortie non nul)
        setStepStatuses((prev) => ({ ...prev, [step.id]: "failed" }));
        isPbSuccess = false;
        failedStepTitle = step.title;
        if (step.stopOnError) {
          onExecuteCommandInTerminal(
            `echo -e "\\n\\e[1;31m[PLAYBOOK PIPELINE] ❌ Étape échouée (stopOnError) : ${step.title}\\e[0m"`,
            selectedSessionId
          );
          break; // arrêt du pipeline conformément à stopOnError
        }
        // stopOnError=false : on continue mais on marque l'échec
        onExecuteCommandInTerminal(
          `echo -e "\\n\\e[1;31m[PLAYBOOK PIPELINE] ⚠️ Étape échouée (poursuite) : ${step.title}\\e[0m"`,
          selectedSessionId
        );
        continue;
      }

      // Succès (code 0) ou code inconnu (pas de canal d'observation)
      setStepStatuses((prev) => ({ ...prev, [step.id]: "success" }));
    }

    // Done header
    if (isPbSuccess) {
      onExecuteCommandInTerminal(
        `echo -e "\\n\\e[1;32m[PLAYBOOK PIPELINE] ✅ Pipeline '${selectedPlaybook.name}' exécuté avec succès !\\e[0m"`,
        selectedSessionId
      );
    } else {
      onExecuteCommandInTerminal(
        `echo -e "\\n\\e[1;31m[PLAYBOOK PIPELINE] ❌ Pipeline terminé avec échec(s)${failedStepTitle ? ` (${failedStepTitle})` : ""}\\e[0m"`,
        selectedSessionId
      );
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);

    // Persist to history list (statut RÉEL, pas toujours "success")
    const newHistItem: PlaybookHistoryItem = {
      id: `h_${Date.now()}`,
      playbookId: selectedPlaybook.id,
      playbookName: selectedPlaybook.name,
      timestamp: Date.now(),
      durationSeconds: duration,
      status: isPbSuccess ? "success" : "failed"
    };
    setHistoryList([newHistItem, ...historyList]);

    setIsRunning(false);
    setRunningStepIndex(null);
    showNotification(
      isPbSuccess
        ? "Pipeline d'automatisation terminé avec succès !"
        : "Pipeline terminé avec des échecs (voir le terminal)."
    );
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
          const updated = [importedPb, ...safePlaybooks];
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
    setIsEditingModalOpen(true);
  };

  const handleOpenEditModal = (pb: Playbook) => {
    setEditingPlaybook(pb);
    setIsEditingModalOpen(true);
  };

  const handleSavePlaybook = (data: { id?: string; name: string; description: string; category: Playbook["category"]; steps: PlaybookStep[] }) => {
    if (!data.name.trim() || data.steps.length === 0) return;

    if (editingPlaybook) {
      const updated = safePlaybooks.map((p) =>
        p.id === editingPlaybook.id
          ? {
              ...p,
              name: data.name,
              description: data.description,
              category: data.category,
              steps: data.steps,
            }
          : p
      );
      savePlaybooks(updated);
      setSelectedPlaybook(updated.find((p) => p.id === editingPlaybook.id) || updated[0]);
      showNotification("Playbook mis à jour avec succès !");
    } else {
      const newPb: Playbook = {
        id: `pb_${Date.now()}`,
        name: data.name,
        description: data.description,
        category: data.category,
        steps: data.steps,
        createdAt: Date.now(),
      };
      savePlaybooks([newPb, ...safePlaybooks]);
      setSelectedPlaybook(newPb);
      showNotification("Nouveau Playbook d'automation créé !");
    }

    setIsEditingModalOpen(false);
  };

  const handleDeletePlaybook = (id: string) => {
    const updated = safePlaybooks.filter((p) => p.id !== id);
    savePlaybooks(updated);
    if (selectedPlaybook?.id === id) {
      setSelectedPlaybook(updated[0] || null);
    }
    showNotification("Playbook supprimé.");
  };

  // Append preset snippet to current form editing steps
  // (handleAppendSnippet extrait dans PlaybookFormModal)

  // Estimation utility
  const getEstimatedDuration = (pb: Playbook | null) => {
    if (!pb) return "0s";
    const sum = pb.steps.reduce((acc, step) => acc + (step.delaySeconds || 1), 0);
    if (sum >= 60) {
      const mins = Math.floor(sum / 60);
      const secs = sum % 60;
      return `${mins}m ${secs}s`;
    }
    return `${sum}s`;
  };

  // Calculate stats values
  const totalRuns = historyList.length;
  const successRate = totalRuns > 0
    ? Math.round((historyList.filter((h) => h.status === "success").length / totalRuns) * 100)
    : 100;
  const avgDuration = totalRuns > 0
    ? Math.round(historyList.reduce((acc, h) => acc + h.durationSeconds, 0) / totalRuns)
    : 0;

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
                {safePlaybooks.length} Pipelines
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

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {safePlaybooks.map((pb) => {
              const isSelected = selectedPlaybook?.id === pb.id;
              return (
                <div
                  key={pb.id}
                  onClick={() => !isRunning && setSelectedPlaybook(pb)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? "bg-teal-500/10 border-teal-500/40 text-teal-200"
                      : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-950 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h4 className="font-bold text-xs font-mono line-clamp-1">{pb.name}</h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-800 border border-slate-700">
                      {pb.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 italic mb-2">
                    {pb.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Durée: {getEstimatedDuration(pb)}
                    </span>
                    <span>{pb.steps.length} étapes</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Metrics History Panel at Bottom-Left */}
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5 text-teal-400" /> Stats d'Automatisation
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                <span className="block text-slate-500 text-[9px] uppercase">Lancements</span>
                <span className="text-xs text-teal-300 font-bold">{totalRuns}</span>
              </div>
              <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                <span className="block text-slate-500 text-[9px] uppercase">Succès</span>
                <span className="text-xs text-emerald-400 font-bold">{successRate}%</span>
              </div>
              <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                <span className="block text-slate-500 text-[9px] uppercase">Durée Moy</span>
                <span className="text-xs text-indigo-400 font-bold">{avgDuration}s</span>
              </div>
            </div>

            {/* Micro SVG graph of last runs durations */}
            {historyList.length > 0 && (
              <div className="bg-slate-950 p-2 rounded border border-slate-800 h-14 relative flex items-end">
                <span className="absolute top-1 left-2 text-[8px] font-mono text-slate-500">Tendance de vitesse d'exécution :</span>
                <svg className="w-full h-8" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path
                    d={`M ${historyList.slice(-8).map((h, i) => `${(i * 100) / 7} ${Math.max(2, 20 - (h.durationSeconds / 10) * 15)}`).join(" L ")}`}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Playbook Execution Console */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-full overflow-hidden">
          {selectedPlaybook ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Playbook Info Header */}
              <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    {selectedPlaybook.name}
                    <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-mono font-normal">
                      Estimé : {getEstimatedDuration(selectedPlaybook)}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 italic">
                    {selectedPlaybook.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadBashScript}
                    title="Télécharger sous forme de script .sh"
                    className="p-2 bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-100 rounded-lg"
                  >
                    <FileCode2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleExportJson}
                    title="Exporter au format JSON"
                    className="p-2 bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-100 rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(selectedPlaybook)}
                    disabled={isRunning}
                    className="p-2 bg-slate-950 border border-slate-800 text-slate-300 hover:text-slate-100 rounded-lg disabled:opacity-45"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeletePlaybook(selectedPlaybook.id)}
                    disabled={isRunning}
                    className="p-2 bg-slate-950 border border-slate-800 text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-45"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <PlaybookStepsView
                playbook={selectedPlaybook}
                stepStatuses={stepStatuses}
                runningStepIndex={runningStepIndex}
              />

              {/* Execution Console Footer */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 font-mono text-xs">
                  <div>
                    <span className="text-slate-500">Terminal PTY :</span>
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      disabled={isRunning}
                      className="ml-2 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-teal-500"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      {sessions.length === 0 && <option value="">Aucun terminal ouvert</option>}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleStartPlaybook}
                  disabled={isRunning || sessions.length === 0}
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-slate-950 font-bold font-mono text-xs rounded-lg shadow-md flex items-center gap-2 self-end transition-all uppercase tracking-wider"
                >
                  <Play className="w-4 h-4 fill-current text-slate-950" />
                  <span>LANCER LE PIPELINE</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <Layers className="w-12 h-12 mb-2 text-slate-700" />
              <p className="text-sm">Sélectionnez ou créez un playbook pour commencer.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal création/édition (composant extrait) */}
      {isEditingModalOpen && (
        <PlaybookFormModal
          editingPlaybook={editingPlaybook}
          onSave={handleSavePlaybook}
          onClose={() => setIsEditingModalOpen(false)}
        />
      )}
    </div>
  );
};
