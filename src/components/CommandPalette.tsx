import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Search,
  Terminal,
  Wrench,
  FileCode,
  Code2,
  Box,
  Bookmark,
  Activity,
  Palette,
  Columns,
  Rows,
  Maximize2,
  Play,
  Zap,
  Bell,
  Sliders,
  Layers,
  Key,
  Sparkles,
  Globe
} from "lucide-react";

import { TerminalSessionInfo, CommandSnippet, Playbook } from "../types";
import { MAINTENANCE_TASKS } from "../constants/snippets";
import { TERMINAL_THEMES } from "../constants/themes";

export interface CommandPaletteAction {
  id: string;
  title: string;
  category: "Nav" | "Maintenance" | "Session" | "Theme" | "Split" | "Action" | "Snippet" | "Playbook";
  description?: string;
  icon: React.ElementType;
  badge?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveView: (view: string) => void;
  sessions: TerminalSessionInfo[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onExecuteMaintenance: (command: string) => void;
  onThemeChange: (themeId: string) => void;
  splitMode: "single" | "horizontal" | "vertical";
  setSplitMode: (mode: "single" | "horizontal" | "vertical") => void;
  onRequestNotifications: () => void;
  notificationsEnabled: boolean;
  snippets: CommandSnippet[];
  playbooks: Playbook[];
  onExecuteInTerminal: (command: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveView,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onExecuteMaintenance,
  onThemeChange,
  splitMode,
  setSplitMode,
  onRequestNotifications,
  notificationsEnabled,
  snippets,
  playbooks,
  onExecuteInTerminal,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build command palette items
  const actions: CommandPaletteAction[] = [
    // Navigation
    {
      id: "nav-terminal",
      title: "Aller aux Terminaux PTY",
      category: "Nav",
      description: "Vue principale avec xterm.js et sessions actives",
      icon: Terminal,
      action: () => {
        setActiveView("terminal");
        onClose();
      },
    },
    {
      id: "nav-ssh",
      title: "Carnet de Connexions SSH & Tunnels Distants",
      category: "Nav",
      description: "Gestion d'hôtes distants (user@host:port), clés et redirections de ports",
      icon: Key,
      action: () => {
        setActiveView("ssh");
        onClose();
      },
    },
    {
      id: "nav-profiles",
      title: "Profils & Environnements Shell",
      category: "Nav",
      description: "Bash, Zsh, Fish, variables d'environnement et persistance d'onglets",
      icon: Sliders,
      action: () => {
        setActiveView("profiles");
        onClose();
      },
    },
    {
      id: "nav-playbooks",
      title: "Séquenceur de Playbooks & Automation",
      category: "Nav",
      description: "Pipelines multi-étapes, export script Bash .sh et JSON",
      icon: Layers,
      action: () => {
        setActiveView("playbooks");
        onClose();
      },
    },
    {
      id: "nav-maint",
      title: "Ouvrir la Maintenance Système",
      category: "Nav",
      description: "Mises à jour APT, nettoyage cache, purge de logs",
      icon: Wrench,
      action: () => {
        setActiveView("maintenance");
        onClose();
      },
    },
    {
      id: "nav-monaco",
      title: "Ouvrir l'Éditeur Monaco",
      category: "Nav",
      description: "Explorateur de fichiers et éditeur de code",
      icon: FileCode,
      action: () => {
        setActiveView("monaco");
        onClose();
      },
    },
    {
      id: "nav-tauri",
      title: "Spécification Architecture Tauri/Rust",
      category: "Nav",
      description: "Code source portable-pty et config Tauri",
      icon: Box,
      action: () => {
        setActiveView("tauri");
        onClose();
      },
    },
    {
      id: "nav-snippets",
      title: "Bibliothèque de Snippets Linux",
      category: "Nav",
      description: "Raccourcis de commandes fréquentes",
      icon: Bookmark,
      action: () => {
        setActiveView("snippets");
        onClose();
      },
    },
    {
      id: "nav-bookmarks",
      title: "Raccourcis Web & Services",
      category: "Nav",
      description: "Sites favoris, aperçu iframe et intégration cURL terminal",
      icon: Globe,
      action: () => {
        setActiveView("bookmarks");
        onClose();
      },
    },
    {
      id: "nav-skills",
      title: "Skills / Fonctions d'Automatisation",
      category: "Nav",
      description: "Macros compilées et créateur de compétences dynamiques",
      icon: Sparkles,
      action: () => {
        setActiveView("skills");
        onClose();
      },
    },
    {
      id: "nav-stats",
      title: "Surveillance des Ressources System",
      category: "Nav",
      description: "RAM, CPU Cores, Load Average, Uptime",
      icon: Activity,
      action: () => {
        setActiveView("stats");
        onClose();
      },
    },

    // Layout Split Actions
    {
      id: "split-single",
      title: "Affichage simple (Session Unique)",
      category: "Split",
      description: "Restaure le terminal en plein écran unique",
      icon: Maximize2,
      badge: splitMode === "single" ? "Actif" : undefined,
      action: () => {
        setSplitMode("single");
        setActiveView("terminal");
        onClose();
      },
    },
    {
      id: "split-horizontal",
      title: "Diviser le terminal Horizontalement (Haut / Bas)",
      category: "Split",
      description: "Affiche 2 sessions de terminal empilées",
      icon: Rows,
      badge: splitMode === "horizontal" ? "Actif" : undefined,
      action: () => {
        setSplitMode("horizontal");
        setActiveView("terminal");
        onClose();
      },
    },
    {
      id: "split-vertical",
      title: "Diviser le terminal Verticalement (Côte à Côte)",
      category: "Split",
      description: "Affiche 2 sessions de terminal côte à côte",
      icon: Columns,
      badge: splitMode === "vertical" ? "Actif" : undefined,
      action: () => {
        setSplitMode("vertical");
        setActiveView("terminal");
        onClose();
      },
    },

    // Session Management
    {
      id: "sess-create",
      title: "Créer une nouvelle session PTY",
      category: "Session",
      description: "Ouvre un nouveau subprocess shell (/bin/bash)",
      icon: Zap,
      action: () => {
        onCreateSession();
        onClose();
      },
    },
    {
      id: "notif-toggle",
      title: notificationsEnabled
        ? "Notifications Système Activées"
        : "Activer les Notifications de Fin de Processus",
      category: "Action",
      description: "Reçois un pop-up quand une commande longue se termine",
      icon: Bell,
      badge: notificationsEnabled ? "Activé" : "Désactivé",
      action: () => {
        onRequestNotifications();
        onClose();
      },
    },

    // Sessions List
    ...sessions.map((s) => ({
      id: `sess-${s.id}`,
      title: `Basculer vers : ${s.name}`,
      category: "Session" as const,
      description: `Shell: ${s.shell} | CWD: ${s.cwd}`,
      icon: Terminal,
      badge: activeSessionId === s.id ? "Actif" : undefined,
      action: () => {
        onSelectSession(s.id);
        setActiveView("terminal");
        onClose();
      },
    })),

    // Maintenance Tasks Shortcuts
    ...MAINTENANCE_TASKS.map((t) => ({
      id: `maint-${t.id}`,
      title: `Exécuter : ${t.title}`,
      category: "Maintenance" as const,
      description: `$ ${t.command}`,
      icon: Play,
      action: () => {
        onExecuteMaintenance(t.command);
        onClose();
      },
    })),

    // Snippets exécutables (recherche globale : lancement direct)
    ...snippets.map((s) => ({
      id: `snip-${s.id}`,
      title: `Exécuter le snippet : ${s.title}`,
      category: "Snippet" as const,
      description: `$ ${s.command}`,
      icon: Code2,
      action: () => {
        onExecuteInTerminal(s.command);
        onClose();
      },
    })),

    // Playbooks (recherche globale : ouverture du séquenceur)
    ...playbooks.map((p) => ({
      id: `pb-${p.id}`,
      title: `Ouvrir le playbook : ${p.name}`,
      category: "Playbook" as const,
      description: `${p.steps.length} étapes — ouvre le séquenceur`,
      icon: Layers,
      action: () => {
        setActiveView("playbooks");
        onClose();
      },
    })),

    // Themes
    ...TERMINAL_THEMES.map((theme) => ({
      id: `theme-${theme.id}`,
      title: `Thème Terminal : ${theme.name}`,
      category: "Theme" as const,
      description: `Appliquer la palette de couleurs ${theme.name}`,
      icon: Palette,
      action: () => {
        onThemeChange(theme.id);
        onClose();
      },
    })),
  ];

  const filteredActions = useMemo(
    () =>
      actions.filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          (a.description && a.description.toLowerCase().includes(query.toLowerCase())) ||
          a.category.toLowerCase().includes(query.toLowerCase())
      ),
    [actions, query]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredActions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? filteredActions.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tapez une commande ou recherchez... (ex: apt, split, dracula, terminal)"
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 font-mono text-sm focus:outline-none"
          />
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            Esc pour fermer
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredActions.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                  isSelected
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                    : "text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-1.5 rounded ${
                      isSelected ? "bg-emerald-500/30 text-emerald-300" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="font-medium text-slate-100 flex items-center gap-2">
                      {item.title}
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {item.category}
                      </span>
                    </div>
                    {item.description && (
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>

                {item.badge && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}

          {filteredActions.length === 0 && (
            <div className="p-6 text-center text-slate-500 text-xs font-mono">
              Aucune commande trouvée pour "{query}"
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>↑↓ Pour naviguer</span>
          <span>↵ Pour exécuter</span>
          <span>Ctrl+Maj+P (Palette)</span>
        </div>
      </div>
    </div>
  );
};
