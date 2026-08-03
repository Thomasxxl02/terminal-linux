import React, { useEffect, useState, useCallback, useMemo } from "react";
import Editor from "@monaco-editor/react";
import {
  FileText,
  Folder,
  FolderOpen,
  Save,
  RefreshCw,
  FileCode,
  ChevronRight,
  Terminal as TermIcon,
  Check,
  AlertCircle,
  Plus,
  FolderPlus,
  FilePlus,
  Trash2,
  Edit3,
  X,
  Settings,
  Search,
  ChevronDown
} from "lucide-react";
import { FileTreeItem } from "../types";

interface MonacoFileEditorProps {
  onExecuteInTerminal: (command: string) => void;
  initialFilePath?: string;
}

interface MonacoTab {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  extension: string;
  isDirty: boolean;
}

interface EditorSettings {
  fontSize: number;
  wordWrap: "on" | "off";
  minimap: boolean;
  theme: string;
  tabSize: number;
}

const getDisplayPath = (fullPath: string): string => {
  if (!fullPath) return "";
  try {
    if (typeof process !== "undefined" && typeof process.cwd === "function") {
      return fullPath.replace(process.cwd(), ".");
    }
  } catch (e) {
    // Ignore error in browser environments
  }
  return fullPath.replace(/^\/app\/applet/, ".").replace(/^\/workspace/, ".");
};

export const MonacoFileEditor: React.FC<MonacoFileEditorProps> = ({
  onExecuteInTerminal,
  initialFilePath,
}) => {
  // Explorer State
  const [currentPath, setCurrentPath] = useState<string>("");
  const [parentPath, setParentPath] = useState<string>("");
  const [items, setItems] = useState<FileTreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tabs State
  const [tabs, setTabs] = useState<MonacoTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // File & Folder CRUD Form State
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>("");

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameName, setRenameName] = useState<string>("");

  const [deletingItem, setDeletingItem] = useState<FileTreeItem | null>(null);

  // Editor Settings State
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("monaco_editor_settings") : null;
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse editor settings", e);
    }
    return {
      fontSize: 13,
      wordWrap: "on",
      minimap: true,
      theme: "vs-dark",
      tabSize: 2,
    };
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateSetting = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    const updated = { ...editorSettings, [key]: value };
    setEditorSettings(updated);
    localStorage.setItem("monaco_editor_settings", JSON.stringify(updated));
  };

  // Map file extension to Monaco language
  const getMonacoLanguage = (ext: string): string => {
    switch (ext.toLowerCase()) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "json":
        return "json";
      case "rs":
        return "rust";
      case "py":
        return "python";
      case "sh":
      case "bash":
      case "zsh":
        return "shell";
      case "html":
        return "html";
      case "css":
        return "css";
      case "md":
        return "markdown";
      case "yml":
      case "yaml":
        return "yaml";
      case "toml":
        return "toml";
      case "sql":
        return "sql";
      case "dockerfile":
        return "dockerfile";
      default:
        return "plaintext";
    }
  };

  // Load File Tree
  const fetchTree = useCallback(async (dirPath?: string) => {
    setLoadingTree(true);
    setErrorMessage(null);
    try {
      const url = dirPath ? `/api/fs/tree?path=${encodeURIComponent(dirPath)}` : "/api/fs/tree";
      const res = await fetch(url);
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        setCurrentPath(data.currentPath);
        setParentPath(data.parentPath);
      } else if (data.error) {
        setErrorMessage(data.error);
      }
    } catch (e) {
      console.error("Failed to load file tree", e);
      setErrorMessage("Impossible de charger l'explorateur");
    } finally {
      setLoadingTree(false);
    }
  }, []);

  // Open / Read file by path
  const openFileByPath = useCallback(async (filePath: string) => {
    // Check if file is already open in a tab
    const existingIndex = tabs.findIndex((t) => t.path === filePath);
    if (existingIndex !== -1) {
      setActiveTabPath(filePath);
      return;
    }

    setLoadingFile(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.content !== undefined) {
        const newTab: MonacoTab = {
          path: data.path,
          name: data.name,
          content: data.content,
          originalContent: data.content,
          extension: getMonacoLanguage(data.extension),
          isDirty: false,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabPath(data.path);
      } else if (data.error) {
        setErrorMessage(data.error);
        // Clear error after 5s
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (e) {
      console.error("Failed to read file", e);
      setErrorMessage("Erreur lors de la lecture du fichier");
    } finally {
      setLoadingFile(false);
    }
  }, [tabs]);

  // Sync initialFilePath on mount or changes
  useEffect(() => {
    if (initialFilePath) {
      openFileByPath(initialFilePath);
      const lastSlashIdx = initialFilePath.lastIndexOf("/");
      const parentDir = lastSlashIdx !== -1 ? initialFilePath.substring(0, lastSlashIdx) : ".";
      fetchTree(parentDir);
    } else {
      fetchTree();
    }
  }, [initialFilePath]);

  // Explorer file click handler
  const handleItemClick = (item: FileTreeItem) => {
    if (item.isDirectory) {
      fetchTree(item.path);
    } else {
      openFileByPath(item.path);
    }
  };

  // Close tab with confirmation if dirty
  const handleCloseTab = (filePath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const tab = tabs.find((t) => t.path === filePath);
    if (tab && tab.isDirty) {
      const confirmClose = window.confirm(
        `Le fichier "${tab.name}" contient des modifications non sauvegardées. Fermer quand même ?`
      );
      if (!confirmClose) return;
    }

    const nextTabs = tabs.filter((t) => t.path !== filePath);
    setTabs(nextTabs);

    if (activeTabPath === filePath) {
      if (nextTabs.length > 0) {
        // Fallback to closest tab
        const closedIdx = tabs.findIndex((t) => t.path === filePath);
        const fallbackIdx = Math.min(closedIdx, nextTabs.length - 1);
        setActiveTabPath(nextTabs[fallbackIdx].path);
      } else {
        setActiveTabPath("");
      }
    }
  };

  // Save specific/active tab file to backend
  const handleSaveFile = async (targetPath: string) => {
    const tabToSave = tabs.find((t) => t.path === targetPath);
    if (!tabToSave) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/fs/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath, content: tabToSave.content }),
      });
      const data = await res.json();
      if (data.success) {
        setTabs((prev) =>
          prev.map((t) =>
            t.path === targetPath
              ? { ...t, originalContent: t.content, isDirty: false }
              : t
          )
        );
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else if (data.error) {
        setErrorMessage(data.error);
      }
    } catch (e) {
      console.error("Failed to save file", e);
      setErrorMessage("Impossible de sauvegarder le fichier");
    } finally {
      setSaving(false);
    }
  };

  // Save all open dirty files
  const handleSaveAll = async () => {
    const dirtyTabs = tabs.filter((t) => t.isDirty);
    if (dirtyTabs.length === 0) return;

    setSaving(true);
    let successCount = 0;
    try {
      for (const t of dirtyTabs) {
        const res = await fetch("/api/fs/write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: t.path, content: t.content }),
        });
        const data = await res.json();
        if (data.success) {
          setTabs((prev) =>
            prev.map((tab) =>
              tab.path === t.path
                ? { ...tab, originalContent: tab.content, isDirty: false }
                : tab
            )
          );
          successCount++;
        }
      }
      if (successCount > 0) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (e) {
      console.error("Failed to save all files", e);
      setErrorMessage("Certains fichiers n'ont pas pu être sauvegardés");
    } finally {
      setSaving(false);
    }
  };

  // Create empty file or folder
  const handleCreateItem = async (isFile: boolean) => {
    const name = newItemName.trim();
    if (!name) return;

    const separator = currentPath.endsWith("/") ? "" : "/";
    const targetPath = `${currentPath}${separator}${name}`;
    const endpoint = isFile ? "/api/fs/create-file" : "/api/fs/create-directory";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath }),
      });
      const data = await res.json();
      if (data.success) {
        setNewItemName("");
        setIsCreatingFile(false);
        setIsCreatingFolder(false);
        fetchTree(currentPath);
        if (isFile) {
          openFileByPath(targetPath);
        }
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e) {
      console.error("Failed to create filesystem item", e);
      alert("Erreur de création");
    }
  };

  // Confirm file/folder rename
  const handleConfirmRename = async (item: FileTreeItem) => {
    const name = renameName.trim();
    if (!name || name === item.name) {
      setRenamingPath(null);
      return;
    }

    const separator = currentPath.endsWith("/") ? "" : "/";
    const newPath = `${currentPath}${separator}${name}`;

    try {
      const res = await fetch("/api/fs/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath: item.path, newPath }),
      });
      const data = await res.json();
      if (data.success) {
        // Sync tabs if open
        setTabs((prev) =>
          prev.map((t) =>
            t.path === item.path
              ? {
                  ...t,
                  path: newPath,
                  name,
                  extension: getMonacoLanguage(name.split(".").pop() || ""),
                }
              : t
          )
        );
        if (activeTabPath === item.path) {
          setActiveTabPath(newPath);
        }

        setRenamingPath(null);
        fetchTree(currentPath);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e) {
      console.error("Rename failed", e);
      alert("Erreur lors du renommage");
    }
  };

  // Confirm delete handler
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    try {
      const res = await fetch("/api/fs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deletingItem.path }),
      });
      const data = await res.json();
      if (data.success) {
        // Remove from tabs if open
        setTabs((prev) => prev.filter((t) => t.path !== deletingItem.path));
        if (activeTabPath === deletingItem.path) {
          setActiveTabPath("");
        }

        setDeletingItem(null);
        fetchTree(currentPath);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e) {
      console.error("Delete failed", e);
      alert("Erreur lors de la suppression");
    }
  };

  // Filter tree items on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return items.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  // Find active tab item
  const activeTab = useMemo(() => {
    return tabs.find((t) => t.path === activeTabPath);
  }, [tabs, activeTabPath]);

  // Handle active editor content change
  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || "";
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activeTabPath
          ? { ...t, content: newValue, isDirty: newValue !== t.originalContent }
          : t
      )
    );
  };

  return (
    <div className="flex flex-1 h-full bg-slate-950 text-slate-200 overflow-hidden select-none">
      {/* Left File Explorer Panel */}
      <div className="w-64 border-r border-slate-800/80 bg-slate-900/40 flex flex-col h-full shrink-0 relative">
        {/* Explorer Header */}
        <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase font-mono tracking-wider">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            Explorateur
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setIsCreatingFile(true);
                setIsCreatingFolder(false);
                setNewItemName("");
              }}
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 rounded transition-colors"
              title="Nouveau fichier"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setIsCreatingFolder(true);
                setIsCreatingFile(false);
                setNewItemName("");
              }}
              className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 rounded transition-colors"
              title="Nouveau dossier"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => fetchTree(currentPath)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTree ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Current Path breadcrumb */}
        <div className="px-3 py-1.5 bg-slate-950 font-mono text-[10px] text-slate-400 truncate border-b border-slate-800/40">
          {getDisplayPath(currentPath)}
        </div>

        {/* In-place creation widgets */}
        {isCreatingFile && (
          <div className="p-2 border-b border-slate-800 bg-slate-950/60 space-y-1.5">
            <span className="text-[9px] text-slate-400 uppercase font-mono flex items-center gap-1">
              <FilePlus className="w-3 h-3 text-emerald-400" /> Nouveau fichier
            </span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="script.ts"
                className="flex-1 bg-slate-900 border border-slate-700/80 text-slate-100 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateItem(true);
                  if (e.key === "Escape") setIsCreatingFile(false);
                }}
              />
              <button
                onClick={() => handleCreateItem(true)}
                className="p-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsCreatingFile(false)}
                className="p-1 bg-slate-850 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {isCreatingFolder && (
          <div className="p-2 border-b border-slate-800 bg-slate-950/60 space-y-1.5">
            <span className="text-[9px] text-slate-400 uppercase font-mono flex items-center gap-1">
              <FolderPlus className="w-3 h-3 text-emerald-400" /> Nouveau dossier
            </span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="composants"
                className="flex-1 bg-slate-900 border border-slate-700/80 text-slate-100 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateItem(false);
                  if (e.key === "Escape") setIsCreatingFolder(false);
                }}
              />
              <button
                onClick={() => handleCreateItem(false)}
                className="p-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsCreatingFolder(false)}
                className="p-1 bg-slate-850 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Search / Filter bar */}
        <div className="p-2 border-b border-slate-800/80 bg-slate-950/20">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer les fichiers..."
              className="w-full bg-slate-950 text-slate-200 border border-slate-800/80 rounded-md pl-8 pr-7 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500/50 placeholder-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-1 absolute right-1.5 top-1 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Directory Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {parentPath && parentPath !== currentPath && (
            <button
              onClick={() => fetchTree(parentPath)}
              className="w-full text-left px-2 py-1.5 rounded text-xs text-emerald-400 hover:bg-slate-800/40 font-mono flex items-center gap-2"
            >
              <Folder className="w-3.5 h-3.5" /> .. (Dossier parent)
            </button>
          )}

          {filteredItems.map((item) => {
            const isItemRenaming = renamingPath === item.path;

            return (
              <div
                key={item.path}
                className={`group w-full rounded text-xs flex items-center justify-between transition-all ${
                  activeTabPath === item.path
                    ? "bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20"
                    : "text-slate-300 hover:bg-slate-800/40"
                }`}
              >
                {isItemRenaming ? (
                  <div className="flex-1 flex items-center gap-1.5 p-1">
                    {item.isDirectory ? (
                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    )}
                    <input
                      type="text"
                      value={renameName}
                      onChange={(e) => setRenameName(e.target.value)}
                      className="flex-1 min-w-0 bg-slate-950 border border-slate-700 text-slate-100 rounded px-1 py-0.5 text-xs font-mono focus:outline-none focus:border-emerald-500"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          handleConfirmRename(item);
                        }
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setRenamingPath(null);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmRename(item);
                      }}
                      className="p-0.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded transition-colors shrink-0"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingPath(null);
                      }}
                      className="p-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => handleItemClick(item)}
                    className="flex-1 flex items-center justify-between px-2 py-1.5 cursor-pointer truncate"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {item.isDirectory ? (
                        <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </div>

                    {/* Actions panel on hover */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0 ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingPath(item.path);
                          setRenameName(item.name);
                        }}
                        className="p-0.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-850 rounded"
                        title="Renommer"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingItem(item);
                        }}
                        className="p-0.5 text-slate-400 hover:text-red-400 hover:bg-slate-850 rounded"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {!item.isDirectory && item.size > 0 && (
                      <span className="text-[9px] font-mono text-slate-500 group-hover:hidden shrink-0 ml-1">
                        {Math.round(item.size / 1024)}k
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Delete confirmation widget overlay */}
        {deletingItem && (
          <div className="absolute inset-x-0 bottom-0 p-3 bg-red-950/95 border-t border-red-850 z-20 space-y-2 text-slate-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs font-mono">
                <p className="font-bold text-red-400">Supprimer définitivement ?</p>
                <p className="text-[10px] text-slate-300 break-all">{deletingItem.name}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 text-[10px] font-mono">
              <button
                onClick={() => setDeletingItem(null)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Monaco Editor View */}
      <div className="flex-1 flex flex-col h-full bg-slate-950 relative">
        {/* Error bar */}
        {errorMessage && (
          <div className="bg-red-950/60 border-b border-red-900/60 text-red-200 px-4 py-2 text-xs font-mono flex items-center justify-between z-10 animate-fade-in shrink-0">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-400" />
              {errorMessage}
            </span>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-red-900/40 rounded text-red-400 hover:text-red-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tabs Bar */}
        {tabs.length > 0 && (
          <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/80 h-10 shrink-0 select-none">
            {/* Scrollable open files row */}
            <div className="flex-1 flex items-center overflow-x-auto h-full scrollbar-none divide-x divide-slate-900/60">
              {tabs.map((tab) => {
                const isActive = tab.path === activeTabPath;
                return (
                  <div
                    key={tab.path}
                    onClick={() => setActiveTabPath(tab.path)}
                    className={`group relative flex items-center gap-2 px-4 h-full text-xs font-mono cursor-pointer transition-all shrink-0 border-t-2 ${
                      isActive
                        ? "bg-slate-900/80 text-emerald-400 font-medium border-t-emerald-500"
                        : "bg-slate-950/30 text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 border-t-transparent"
                    }`}
                    title={tab.path}
                  >
                    <FileCode className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                    <span className="truncate max-w-[120px]">{tab.name}</span>

                    {/* Unsaved changes dot indicator */}
                    {tab.isDirty && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    )}

                    {/* Close tab button */}
                    <button
                      onClick={(e) => handleCloseTab(tab.path, e)}
                      className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Global dirty tabs status / Save All */}
            {tabs.some((t) => t.isDirty) && (
              <div className="px-3 shrink-0 flex items-center">
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="px-2 py-1 text-[10px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-semibold font-mono rounded border border-amber-500/30 transition-all uppercase tracking-wider"
                >
                  Sauver tout
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab ? (
          <>
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 text-xs shrink-0">
              <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] truncate mr-4">
                <span>{getDisplayPath(activeTab.path)}</span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  {activeTab.extension}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Cat in terminal */}
                <button
                  onClick={() => onExecuteInTerminal(`cat "${activeTab.path}"`)}
                  className="px-2.5 py-1 text-slate-300 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-800 rounded text-[11px] font-mono flex items-center gap-1.5 transition-colors border border-slate-700/30"
                  title="Afficher dans le terminal avec cat"
                >
                  <TermIcon className="w-3.5 h-3.5 text-emerald-400" /> Cat dans Terminal
                </button>

                {/* Editor settings trigger */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded transition-colors ${
                    showSettings ? "bg-slate-850 text-emerald-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                  title="Paramètres de l'éditeur"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Save active tab */}
                <button
                  onClick={() => handleSaveFile(activeTab.path)}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded text-xs font-semibold font-mono flex items-center gap-1.5 transition-all ${
                    saveSuccess
                      ? "bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-600/10"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Sauvegardé !
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Sauvegarder
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Monaco Editor Container */}
            <div className="flex-1 w-full h-full relative overflow-hidden">
              {loadingFile ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10 text-slate-400 text-xs font-mono gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                  <span>Chargement du fichier...</span>
                </div>
              ) : null}

              <Editor
                height="100%"
                language={activeTab.extension}
                theme={editorSettings.theme}
                value={activeTab.content}
                onChange={handleEditorChange}
                options={{
                  fontSize: editorSettings.fontSize,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: editorSettings.minimap },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: editorSettings.tabSize,
                  wordWrap: editorSettings.wordWrap,
                  smoothScrolling: true,
                  padding: { top: 10, bottom: 10 },
                }}
              />
            </div>
          </>
        ) : (
          /* Empty state / Welcome */
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 bg-slate-950">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
              <FileCode className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-slate-300 mb-1">Monaco Code & File Editor</h3>
            <p className="text-xs text-slate-400 max-w-sm text-center mb-4">
              Sélectionnez n'importe quel fichier dans l'explorateur à gauche pour l'éditer en direct avec coloration syntaxique complète, ou créez-en de nouveaux.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsCreatingFile(true);
                  setIsCreatingFolder(false);
                  setNewItemName("");
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 font-mono text-[11px] font-semibold border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" /> Nouveau fichier
              </button>
              <button
                onClick={() => fetchTree()}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 font-mono text-[11px] font-semibold border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Parcourir la racine
              </button>
            </div>
          </div>
        )}

        {/* Editor Settings Drawer */}
        {showSettings && (
          <div className="absolute right-4 top-14 w-64 bg-slate-900/95 border border-slate-800 rounded-lg shadow-2xl p-4 z-50 text-slate-200">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <span className="font-semibold text-xs flex items-center gap-1.5 font-mono text-emerald-400">
                <Settings className="w-3.5 h-3.5" /> Paramètres Éditeur
              </span>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">Thème de l'éditeur</label>
                <select
                  value={editorSettings.theme}
                  onChange={(e) => updateSetting("theme", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="vs-dark">Dark (VS-Dark)</option>
                  <option value="light">Light (VS-Light)</option>
                  <option value="hc-black">High Contrast (HC-Black)</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">Taille de police</label>
                <select
                  value={editorSettings.fontSize}
                  onChange={(e) => updateSetting("fontSize", parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {[11, 12, 13, 14, 15, 16, 18, 20].map((size) => (
                    <option key={size} value={size}>{size} px</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-mono text-slate-300">Retour ligne (Word Wrap)</span>
                <button
                  onClick={() => updateSetting("wordWrap", editorSettings.wordWrap === "on" ? "off" : "on")}
                  className={`px-2 py-1 text-[10px] font-mono rounded font-semibold transition-colors ${
                    editorSettings.wordWrap === "on"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-800"
                  }`}
                >
                  {editorSettings.wordWrap === "on" ? "ACTIF" : "INACTIF"}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300">Minimap</span>
                <button
                  onClick={() => updateSetting("minimap", !editorSettings.minimap)}
                  className={`px-2 py-1 text-[10px] font-mono rounded font-semibold transition-colors ${
                    editorSettings.minimap
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-800"
                  }`}
                >
                  {editorSettings.minimap ? "VISIBLE" : "MASQUÉ"}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300">Tabulations</span>
                <select
                  value={editorSettings.tabSize}
                  onChange={(e) => updateSetting("tabSize", parseInt(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="2">2 espaces</option>
                  <option value="4">4 espaces</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
