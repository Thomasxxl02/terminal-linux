import React, { useState } from "react";
import {
  Globe,
  Plus,
  Search,
  ExternalLink,
  Star,
  Trash2,
  Edit2,
  Copy,
  Check,
  Download,
  Upload,
  Terminal,
  Folder,
  Tag,
  X,
  Eye,
  Server,
  Code,
  Shield,
  Layers,
  Cpu,
  Bookmark,
  Sparkles,
  CheckCircle2,
  Filter
} from "lucide-react";
import { WebShortcut, TerminalSessionInfo } from "../types";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { Tooltip } from "./Tooltip";
import { ConfirmationModal } from "./ConfirmationModal";
import { WebShortcutFormModal } from "./WebShortcutFormModal";
import { WebShortcutPreviewModal } from "./WebShortcutPreviewModal";
import { WebShortcutImportModal } from "./WebShortcutImportModal";

const DEFAULT_SHORTCUTS: WebShortcut[] = [
  {
    id: "sc-1",
    title: "GitHub Repository",
    url: "https://github.com",
    description: "Gestion de code source et CI/CD workflows",
    category: "Dev",
    color: "sky",
    tags: ["git", "code", "ci-cd"],
    isFavorite: true,
    openMode: "new_tab",
    createdAt: Date.now() - 86400000 * 10,
  },
  {
    id: "sc-2",
    title: "Documentation Rust",
    url: "https://doc.rust-lang.org/std/",
    description: "Standard Library Documentation pour Rust & Cargo",
    category: "Docs",
    color: "amber",
    tags: ["rust", "documentation", "crates"],
    isFavorite: true,
    openMode: "new_tab",
    createdAt: Date.now() - 86400000 * 8,
  },
  {
    id: "sc-3",
    title: "Grafana Local Dashboard",
    url: "http://localhost:3000",
    description: "Supervision des métriques système et logs d'infrastructure",
    category: "Monitoring",
    color: "emerald",
    tags: ["monitoring", "metrics", "grafana"],
    isFavorite: true,
    openMode: "embedded",
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: "sc-4",
    title: "Portainer UI (Localhost:9000)",
    url: "http://localhost:9000",
    description: "Gestion des conteneurs Docker & volumes locaux",
    category: "Services",
    color: "purple",
    tags: ["docker", "containers", "devops"],
    isFavorite: false,
    openMode: "embedded",
    createdAt: Date.now() - 86400000 * 4,
  },
  {
    id: "sc-5",
    title: "Tailwind CSS Documentation",
    url: "https://tailwindcss.com/docs",
    description: "Guide des classes utilitaires et composants Tailwind",
    category: "Docs",
    color: "sky",
    tags: ["css", "ui", "design"],
    isFavorite: false,
    openMode: "new_tab",
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: "sc-6",
    title: "Docker Hub Registry",
    url: "https://hub.docker.com",
    description: "Recherche d'images officielles Alpine, Ubuntu, Nginx, PostgreSQL",
    category: "Cloud",
    color: "blue",
    tags: ["docker", "registry", "cloud"],
    isFavorite: false,
    openMode: "new_tab",
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: "sc-7",
    title: "Stack Overflow",
    url: "https://stackoverflow.com",
    description: "Questions & réponses de développement communautaire",
    category: "Dev",
    color: "amber",
    tags: ["dev", "help", "debug"],
    isFavorite: false,
    openMode: "new_tab",
    createdAt: Date.now() - 86400000 * 1,
  }
];

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  sky: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
};

interface WebShortcutsManagerProps {
  onExecuteInTerminal?: (cmd: string) => void;
  sessions?: TerminalSessionInfo[];
  activeSessionId?: string | null;
}

export const WebShortcutsManager: React.FC<WebShortcutsManagerProps> = ({
  onExecuteInTerminal,
}) => {
  const [shortcuts, setShortcuts] = useLocalStorage<WebShortcut[]>(
    "terminal_studio_web_shortcuts",
    DEFAULT_SHORTCUTS
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal create/edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<WebShortcut | null>(null);
  // (formTitle/formUrl/formDescription/formCategory/formColor/formTags/
  //  formOpenMode extraits dans WebShortcutFormModal.tsx)

  // Embedded Preview Modal state
  const [previewShortcut, setPreviewShortcut] = useState<WebShortcut | null>(null);

  // Delete Confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Import/Export state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const categories = ["Tous", "Favoris", ...Array.from(new Set(shortcuts.map((s) => s.category)))];

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const handleOpenCreateModal = () => {
    setEditingShortcut(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sc: WebShortcut) => {
    setEditingShortcut(sc);
    setIsModalOpen(true);
  };

  const handleSaveShortcut = (data: {
    title: string;
    url: string;
    description: string;
    category: string;
    color: string;
    tags: string[];
    openMode: "new_tab" | "embedded" | "curl_terminal";
  }) => {
    if (editingShortcut) {
      setShortcuts(
        shortcuts.map((s) =>
          s.id === editingShortcut.id
            ? {
                ...s,
                title: data.title,
                url: data.url,
                description: data.description,
                category: data.category,
                color: data.color,
                tags: data.tags,
                openMode: data.openMode,
              }
            : s
        )
      );
      showNotification("Raccourci mis à jour avec succès.");
    } else {
      const newSc: WebShortcut = {
        id: `sc-${Date.now()}`,
        title: data.title,
        url: data.url,
        description: data.description,
        category: data.category,
        color: data.color,
        tags: data.tags,
        isFavorite: false,
        openMode: data.openMode,
        createdAt: Date.now(),
      };
      setShortcuts([newSc, ...shortcuts]);
      showNotification("Nouveau raccourci web créé.");
    }

    setIsModalOpen(false);
  };

  const handleDeleteShortcut = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      setShortcuts(shortcuts.filter((s) => s.id !== confirmDeleteId));
      showNotification("Raccourci supprimé.");
      setConfirmDeleteId(null);
    }
  };

  const handleToggleFavorite = (id: string) => {
    setShortcuts(
      shortcuts.map((s) =>
        s.id === id ? { ...s, isFavorite: !s.isFavorite } : s
      )
    );
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLaunchShortcut = (sc: WebShortcut) => {
    // Record visit timestamp
    setShortcuts(
      shortcuts.map((s) => (s.id === sc.id ? { ...s, lastVisitedAt: Date.now() } : s))
    );

    if (sc.openMode === "embedded") {
      setPreviewShortcut(sc);
    } else if (sc.openMode === "curl_terminal" && onExecuteInTerminal) {
      onExecuteInTerminal(`curl -i -L "${sc.url}"`);
      showNotification(`Requête cURL envoyée vers ${sc.url}`);
    } else {
      window.open(sc.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleTestCurlInTerminal = (sc: WebShortcut) => {
    if (onExecuteInTerminal) {
      onExecuteInTerminal(`curl -I "${sc.url}"`);
      showNotification(`Test d'en-tête cURL lancé pour ${sc.title}`);
    }
  };

  // Import / Export JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(shortcuts, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `raccourcis_web_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification("Raccourcis exportés en JSON.");
  };

  const handleImportJson = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importJsonText);
      if (Array.isArray(parsed)) {
        setShortcuts(parsed);
        setIsImportModalOpen(false);
        setImportJsonText("");
        showNotification(`${parsed.length} raccourcis importés avec succès.`);
      } else {
        alert("Format JSON invalide. Doit être un tableau de raccourcis.");
      }
    } catch {
      alert("Erreur de parsing JSON. Vérifiez votre syntaxe.");
    }
  };

  // Filter shortcuts
  const filteredShortcuts = shortcuts.filter((sc) => {
    const matchesSearch =
      sc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sc.description && sc.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (sc.tags && sc.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    if (selectedCategory === "Tous") return matchesSearch;
    if (selectedCategory === "Favoris") return matchesSearch && sc.isFavorite;
    return matchesSearch && sc.category === selectedCategory;
  });

  const getDomainFromUrl = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname;
    } catch {
      return urlStr;
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col h-full overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Raccourcis Web & Services
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {shortcuts.length} enregistrés
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Accès rapide, intégration cURL dans le terminal et prévisualisation de vos applications web
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip content="Exporter la liste en fichier JSON" position="bottom">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono font-medium rounded-lg border border-slate-700/80 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter</span>
            </button>
          </Tooltip>

          <Tooltip content="Importer une sauvegarde JSON" position="bottom">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono font-medium rounded-lg border border-slate-700/80 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importer</span>
            </button>
          </Tooltip>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-mono font-bold rounded-lg shadow-md transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nouveau Raccourci</span>
          </button>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {notificationMsg && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-xs font-mono text-emerald-300 flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {notificationMsg}
          </span>
          <button onClick={() => setNotificationMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/30 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par titre, URL ou tag..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 pl-9 pr-8 py-1.5 text-xs rounded-lg focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-slate-500 font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-1 shrink-0" />
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isSelected
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                {cat === "Favoris" ? "★ Favoris" : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shortcuts List / Grid */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {filteredShortcuts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShortcuts.map((sc) => {
              const colorTheme = COLOR_CLASSES[sc.color || "sky"] || COLOR_CLASSES.sky;
              const domain = getDomainFromUrl(sc.url);
              const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

              return (
                <div
                  key={sc.id}
                  className="group relative bg-slate-900 border border-slate-800/90 rounded-xl p-4 hover:border-slate-700 hover:shadow-xl transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Favicon/Icon + Title + Favorite Star */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg ${colorTheme.bg} border ${colorTheme.border} flex items-center justify-center shrink-0 overflow-hidden p-1`}>
                          <img
                            src={faviconUrl}
                            alt=""
                            className="w-5 h-5 object-contain"
                            onError={(e) => {
                              // Fallback to Globe icon if favicon load fails
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <Globe className={`w-4 h-4 ${colorTheme.text}`} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-100 truncate group-hover:text-emerald-300 transition-colors">
                            {sc.title}
                          </h3>
                          <a
                            href={sc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-slate-400 hover:text-slate-300 truncate block hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {sc.url}
                          </a>
                        </div>
                      </div>

                      <Tooltip content={sc.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"} position="top">
                        <button
                          onClick={() => handleToggleFavorite(sc.id)}
                          className={`p-1 rounded-md transition-colors ${
                            sc.isFavorite
                              ? "text-amber-400 hover:text-amber-300 bg-amber-500/10"
                              : "text-slate-600 hover:text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <Star className={`w-4 h-4 ${sc.isFavorite ? "fill-amber-400" : ""}`} />
                        </button>
                      </Tooltip>
                    </div>

                    {/* Description */}
                    {sc.description && (
                      <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                        {sc.description}
                      </p>
                    )}

                    {/* Tags & Category Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-4">
                      <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${colorTheme.bg} ${colorTheme.text} ${colorTheme.border}`}>
                        {sc.category}
                      </span>
                      {sc.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
                    <div className="flex items-center gap-1">
                      <Tooltip content="Copier l'adresse URL" position="top">
                        <button
                          onClick={() => handleCopyUrl(sc.url, sc.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                        >
                          {copiedId === sc.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </Tooltip>

                      {onExecuteInTerminal && (
                        <Tooltip content="Envoyer commande cURL au terminal" position="top">
                          <button
                            onClick={() => handleTestCurlInTerminal(sc)}
                            title="Envoyer commande cURL au terminal"
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      )}

                      <Tooltip content="Éditer le raccourci" position="top">
                        <button
                          onClick={() => handleOpenEditModal(sc)}
                          aria-label={`Éditer ${sc.title}`}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>

                      <Tooltip content="Supprimer ce raccourci" position="top">
                        <button
                          onClick={() => handleDeleteShortcut(sc.id)}
                          aria-label={`Supprimer ${sc.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>

                    {/* Launch Button */}
                    <button
                      onClick={() => handleLaunchShortcut(sc)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-200 text-xs font-mono font-bold rounded-lg transition-all border border-slate-700/80"
                    >
                      <span>Ouvrir</span>
                      {sc.openMode === "embedded" ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
            <Globe className="w-10 h-10 text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-slate-300 mb-1">
              Aucun raccourci web trouvé
            </h3>
            <p className="text-xs text-slate-500 mb-4 max-w-sm">
              {searchQuery
                ? `Aucun résultat pour la recherche "${searchQuery}".`
                : "Créez votre premier raccourci pour vos sites et applications web préférés."}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition-colors font-mono"
            >
              <Plus className="w-4 h-4" />
              Créer un Raccourci
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <WebShortcutFormModal
          editingShortcut={editingShortcut}
          onSave={handleSaveShortcut}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {previewShortcut && (
        <WebShortcutPreviewModal
          shortcut={previewShortcut}
          onClose={() => setPreviewShortcut(null)}
          onRefresh={() => {
            const currentSc = previewShortcut;
            setPreviewShortcut(null);
            setTimeout(() => setPreviewShortcut(currentSc), 50);
          }}
        />
      )}

      {isImportModalOpen && (
        <WebShortcutImportModal
          importJsonText={importJsonText}
          setImportJsonText={setImportJsonText}
          handleImportJson={handleImportJson}
          onClose={() => setIsImportModalOpen(false)}
        />
      )}

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={confirmDeleteId !== null}
        title="Supprimer le Raccourci Web ?"
        message={`Voulez-vous vraiment supprimer "${shortcuts.find((s) => s.id === confirmDeleteId)?.title || "ce raccourci"}" ?`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
        type="danger"
      />
    </div>
  );
};
