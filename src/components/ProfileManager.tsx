import React, { useState } from "react";
import {
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Play,
  RotateCcw,
  CheckCircle2,
  BookmarkCheck,
  Sparkles,
  Layers,
  Terminal,
  Activity,
  FileCode2,
  Check,
  AlertCircle,
  HelpCircle,
  Cpu
} from "lucide-react";
import { ShellProfile, SavedTabSession, TerminalSessionInfo } from "../types";
import { useSecureStorage } from "../hooks/useSecureStorage";
import { apiFetch } from "../lib/api";
import { isTauri, tauriInvoke } from "../lib/tauri";
import { Tooltip } from "./Tooltip";
import { ConfirmationModal } from "./ConfirmationModal";
import { ProfileFormModal } from "./ProfileFormModal";

const DEFAULT_PROFILES: ShellProfile[] = [
  {
    id: "profile_bash_default",
    name: "Bash Standard (Dev)",
    shell: "/bin/bash",
    cwd: typeof process !== "undefined" && process.cwd ? process.cwd() : "/",
    env: {
      COLORTERM: "truecolor",
      TERM: "xterm-256color",
      EDITOR: "nano"
    },
    color: "#10b981",
    iconName: "Terminal",
    isDefault: true,
    startupScript: "echo -e '\\n\\e[1;32m[SHELL INFO] Bienvenue dans le terminal Bash d\\'administration !\\e[0m\\n' && uptime"
  },
  {
    id: "profile_zsh_sysadmin",
    name: "Zsh System Admin",
    shell: "/bin/zsh",
    cwd: "/var/log",
    env: {
      COLORTERM: "truecolor",
      LOG_LEVEL: "debug",
      PAGER: "cat"
    },
    color: "#3b82f6",
    iconName: "Sliders",
    startupScript: "echo -e '\\n\\e[1;34m[SYSTEM AUDIT] Audit rapide de l\\'espace disque :\\e[0m\\n' && df -h /"
  },
  {
    id: "profile_fish_analytics",
    name: "Fish Shell Analytics",
    shell: "fish",
    cwd: "/tmp",
    env: {
      PYTHONUNBUFFERED: "1"
    },
    color: "#ec4899",
    iconName: "Sparkles",
    startupScript: "echo '=== Mode Interactif Fish activé ==='"
  },
  {
    id: "profile_sh_minimal",
    name: "POSIX Sh Sandbox",
    shell: "/bin/sh",
    cwd: "/",
    env: {
      PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    },
    color: "#f59e0b",
    iconName: "Layers"
  }
];

const STORAGE_KEY_PROFILES = "tauri_linux_shell_profiles";
const STORAGE_KEY_SAVED_TABS = "tauri_linux_saved_tabs";

interface ProfileManagerProps {
  onLaunchProfile: (profile: ShellProfile) => void;
  activeSessions: TerminalSessionInfo[];
  onRestoreSavedTabs: (tabs: SavedTabSession[]) => void;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  onLaunchProfile,
  activeSessions,
  onRestoreSavedTabs,
}) => {
  const { value: profilesValue, setValue: setProfiles } = useSecureStorage<ShellProfile[]>(
    STORAGE_KEY_PROFILES,
    DEFAULT_PROFILES
  );
  const profiles = profilesValue ?? DEFAULT_PROFILES;
  const { value: savedTabsValue, setValue: setSavedTabs } = useSecureStorage<SavedTabSession[]>(
    STORAGE_KEY_SAVED_TABS,
    []
  );
  const savedTabs = savedTabsValue ?? [];
  const [editingProfile, setEditingProfile] = useState<ShellProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Shell compatibility check state
  const [isCheckingShells, setIsCheckingShells] = useState(false);
  const [shellValidationLogs, setShellValidationLogs] = useState<string[]>([]);
  const [showValidator, setShowValidator] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formShell, setFormShell] = useState("/bin/bash");
  const [formCwd, setFormCwd] = useState("/");
  const [formColor, setFormColor] = useState("#10b981");
  const [formStartupScript, setFormStartupScript] = useState("");
  const [formIconName, setFormIconName] = useState("Terminal");
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>([
    { key: "COLORTERM", value: "truecolor" }
  ]);

  const handleOpenCreateModal = () => {
    setFormName("Nouveau Profil Custom");
    setFormShell("/bin/bash");
    setFormCwd("/");
    setFormColor("#6366f1");
    setFormStartupScript("");
    setFormIconName("Terminal");
    setEnvPairs([{ key: "CUSTOM_VAR", value: "value" }]);
    setEditingProfile(null);
    setIsCreating(true);
  };

  const handleOpenEditModal = (profile: ShellProfile) => {
    setFormName(profile.name);
    setFormShell(profile.shell);
    setFormCwd(profile.cwd);
    setFormColor(profile.color);
    setFormStartupScript(profile.startupScript || "");
    setFormIconName(profile.iconName || "Terminal");
    const envArray = Object.entries(profile.env).map(([key, value]) => ({ key, value }));
    setEnvPairs(envArray.length > 0 ? envArray : [{ key: "", value: "" }]);
    setEditingProfile(profile);
    setIsCreating(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const envMap: Record<string, string> = {};
    envPairs.forEach((pair) => {
      if (pair.key.trim()) {
        envMap[pair.key.trim()] = pair.value;
      }
    });

    if (editingProfile) {
      const updated = profiles.map((p) =>
        p.id === editingProfile.id
          ? {
              ...p,
              name: formName,
              shell: formShell,
              cwd: formCwd,
              color: formColor,
              env: envMap,
              startupScript: formStartupScript.trim() || undefined,
              iconName: formIconName,
            }
          : p
      );
      setProfiles(updated);
      showNotification("Profil mis à jour avec succès");
    } else {
      const newProf: ShellProfile = {
        id: `profile_${Date.now()}`,
        name: formName,
        shell: formShell,
        cwd: formCwd,
        color: formColor,
        env: envMap,
        startupScript: formStartupScript.trim() || undefined,
        iconName: formIconName,
      };
      setProfiles([...profiles, newProf]);
      showNotification("Nouveau profil shell créé !");
    }

    setIsCreating(false);
    setEditingProfile(null);
  };

  const handleDeleteProfile = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDeleteProfile = () => {
    if (confirmDeleteId) {
      const updated = profiles.filter((p) => p.id !== confirmDeleteId);
      setProfiles(updated);
      showNotification("Profil supprimé.");
      setConfirmDeleteId(null);
    }
  };

  const handleSetDefaultProfile = (id: string) => {
    const updated = profiles.map((p) => ({
      ...p,
      isDefault: p.id === id,
    }));
    setProfiles(updated);
    showNotification("Profil par défaut mis à jour");
  };

  // Tab Persistence Actions
  const handleSaveCurrentActiveTabs = () => {
    if (activeSessions.length === 0) return;
    const tabsToSave: SavedTabSession[] = activeSessions.map((s) => ({
      id: s.id,
      name: s.name,
      shell: s.shell,
      cwd: s.cwd,
    }));
    setSavedTabs(tabsToSave);
    showNotification(`${tabsToSave.length} onglet(s) sauvegardé(s) pour la persistance !`);
  };

  const handleRestoreTabs = () => {
    if (savedTabs.length > 0) {
      onRestoreSavedTabs(savedTabs);
      showNotification("Restauration des onglets en cours...");
    }
  };

  const showNotification = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 3000);
  };

  // Audit RÉEL des shells : vérifie l'existence + version sur le système
  // (commande Rust check_shells en Tauri, route /api/shells/check en web).
  const handleRunShellAudit = async () => {
    setIsCheckingShells(true);
    setShellValidationLogs([]);
    setShowValidator(true);

    try {
      let shells: { name: string; path: string; present: boolean; version: string }[];
      if (isTauri()) {
        shells = await tauriInvoke("check_shells");
      } else {
        const res = await apiFetch("/api/shells/check");
        const data = await res.json();
        shells = data.shells;
      }

      const logs: string[] = [
        "[SYS] Audit d'intégrité des terminaux (vérification réelle)...",
      ];
      for (const s of shells) {
        if (s.name === "env") {
          logs.push(`[ENV] ${s.version}`);
          continue;
        }
        if (s.present) {
          logs.push(`[CHECK] '${s.path}' présent — ${s.version || "version inconnue"}`);
        } else {
          logs.push(`[WARN] '${s.path}' non détecté. Installation: sudo apt install ${s.name}`);
        }
      }
      const presentCount = shells.filter((s) => s.present && s.name !== "env").length;
      logs.push(`[RAPPORT] ${presentCount} shells détectés sur le système.`);

      let currentLog = 0;
      const interval = setInterval(() => {
        if (currentLog < logs.length) {
          setShellValidationLogs((prev) => [...prev, logs[currentLog]]);
          currentLog++;
        } else {
          clearInterval(interval);
          setIsCheckingShells(false);
        }
      }, 250);
    } catch (e) {
      console.error("Failed to run shell audit", e);
      setShellValidationLogs(["Erreur lors de l'audit des shells."]);
      setIsCheckingShells(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col h-full overflow-hidden">
      {/* Top Banner */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Gestionnaire de Profils & Environnements Shell
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                {profiles.length} Profils
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Configurez des shells personnalisés (/bin/bash, /bin/zsh, fish), dossiers initiaux et variables d'environnement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunShellAudit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-mono rounded-lg border border-slate-700 transition-colors"
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Vérifier Compatibilité</span>
          </button>

          <button
            onClick={handleSaveCurrentActiveTabs}
            disabled={activeSessions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-mono rounded-lg border border-slate-700 transition-colors"
            title="Sauvegarder les onglets PTY actuellement ouverts dans le stockage local"
          >
            <BookmarkCheck className="w-4 h-4 text-emerald-400" />
            <span>Sauvegarder Session ({activeSessions.length})</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono rounded-lg shadow transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Créer un Profil</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {successBanner && (
        <div className="mx-4 mt-3 px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-200 text-xs font-mono flex items-center gap-2 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Shell Compatibility Section */}
        {showValidator && (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative">
            <button
              onClick={() => setShowValidator(false)}
              className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 text-xs font-mono"
            >
              Fermer
            </button>
            <h4 className="text-xs font-bold font-mono text-slate-200 flex items-center gap-2 mb-2 uppercase tracking-wide">
              <Activity className="w-4 h-4 text-emerald-400" />
              Rapport d'Intégrité des Shells Système
            </h4>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1.5 text-slate-300">
              {shellValidationLogs.filter(Boolean).map((log, idx) => {
                let colorClass = "text-slate-300";
                if (log.includes("[SUCCESS]")) colorClass = "text-emerald-400 font-semibold";
                if (log.includes("[WARN]")) colorClass = "text-amber-400";
                if (log.includes("[SYS]")) colorClass = "text-indigo-400 font-bold";
                return (
                  <div key={idx} className={colorClass}>
                    {log}
                  </div>
                );
              })}
              {isCheckingShells && (
                <div className="text-emerald-400 animate-pulse">Audit en cours... [■■■■■■■■□□]</div>
              )}
            </div>
          </div>
        )}

        {/* Saved Session Restoration Box */}
        {savedTabs.length > 0 && (
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  Persistance des Onglets Sauvegardés ({savedTabs.length} Terminal(s))
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  {savedTabs.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                    >
                      {t.name} ({t.shell})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleRestoreTabs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-mono text-xs font-bold rounded-lg shadow transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurer la Session
            </button>
          </div>
        )}

        {/* Profiles Grid */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 font-semibold flex items-center justify-between">
            <span>PROFILS SHELL DISPONIBLES</span>
            <span className="text-[11px] text-slate-500">Cliquez sur "Lancer" pour ouvrir un terminal avec cette configuration</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((prof) => (
              <div
                key={prof.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between transition-all shadow-md group relative overflow-hidden"
              >
                {/* Accent Color Strip */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: prof.color }}
                />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: prof.color }}
                      />
                      <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-1.5">
                        {prof.name}
                        {prof.startupScript && (
                          <span title="Script de démarrage inclus">
                            <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )}
                      </h4>
                    </div>

                    {prof.isDefault ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Par Défaut
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefaultProfile(prof.id)}
                        className="text-[10px] font-mono text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Définir par défaut
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 my-3 font-mono text-xs">
                    <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-slate-300">
                      <span className="text-slate-500 text-[11px]">Shell Exec:</span>
                      <span className="text-emerald-400 font-bold">{prof.shell}</span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-slate-300">
                      <span className="text-slate-500 text-[11px]">CWD Initial:</span>
                      <span className="text-slate-300 truncate max-w-[180px]" title={prof.cwd}>
                        {prof.cwd}
                      </span>
                    </div>

                    {/* Env Vars count */}
                    <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 text-slate-300">
                      <span className="text-slate-500 text-[11px]">Env Custom:</span>
                      <span className="text-slate-400 text-[11px]">
                        {Object.keys(prof.env).length} variable(s)
                      </span>
                    </div>
                  </div>

                  {/* Startup Script Preview if exists */}
                  {prof.startupScript && (
                    <div className="mt-2.5 p-2 bg-slate-950/60 border border-slate-800 rounded font-mono text-[10px] text-slate-400">
                      <span className="text-[9px] text-amber-500 font-semibold block mb-0.5">🚀 Script de Démarrage :</span>
                      <span className="line-clamp-1 italic text-slate-300">{prof.startupScript}</span>
                    </div>
                  )}

                  {/* Environment Vars preview chips */}
                  {Object.keys(prof.env).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5 mb-1">
                      {Object.entries(prof.env).slice(0, 3).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/80"
                        >
                          {k}={v}
                        </span>
                      ))}
                      {Object.keys(prof.env).length > 3 && (
                        <span className="text-[10px] text-slate-500">+{Object.keys(prof.env).length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1">
                    <Tooltip content="Éditer la configuration de ce profil" position="top">
                      <button
                        onClick={() => handleOpenEditModal(prof)}
                        aria-label={`Éditer le profil ${prof.name}`}
                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    {!prof.isDefault && (
                      <Tooltip content="Supprimer définitivement ce profil" position="top">
                        <button
                          onClick={() => handleDeleteProfile(prof.id)}
                          aria-label={`Supprimer le profil ${prof.name}`}
                          className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    )}
                  </div>

                  <button
                    onClick={() => onLaunchProfile(prof)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono rounded shadow transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Lancer PTY</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isCreating && (
        <ProfileFormModal
          editingProfile={editingProfile}
          formName={formName}
          setFormName={setFormName}
          formShell={formShell}
          setFormShell={setFormShell}
          formCwd={formCwd}
          setFormCwd={setFormCwd}
          formColor={formColor}
          setFormColor={setFormColor}
          formStartupScript={formStartupScript}
          setFormStartupScript={setFormStartupScript}
          envPairs={envPairs}
          setEnvPairs={setEnvPairs}
          handleSaveProfile={handleSaveProfile}
          onClose={() => setIsCreating(false)}
        />
      )}

      <ConfirmationModal
        isOpen={confirmDeleteId !== null}
        title="Supprimer le Profil Shell ?"
        message={`Voulez-vous vraiment supprimer le profil "${profiles.find((p) => p.id === confirmDeleteId)?.name || "ce profil"}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleConfirmDeleteProfile}
        onCancel={() => setConfirmDeleteId(null)}
        type="danger"
      />
    </div>
  );
};
