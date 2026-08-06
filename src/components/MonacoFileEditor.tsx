import React, { useEffect, useState, useCallback, useMemo } from "react";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "motion/react";
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
  ChevronDown,
  PanelLeft,
  Laptop,
  UploadCloud,
  CheckCircle2
} from "lucide-react";
import { FileTreeItem } from "../types";
import { fsTree, fsRead, fsWrite, fsCreateFile, fsCreateDirectory, fsDelete, fsRename } from "../lib/fsApi";

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
  autoSave: boolean;
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
  // Navigation / Mode state — mode local uniquement (le mode "SFTP distant"
  // simulé a été supprimé : il présentait de fausses données comme réelles)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Explorer State
  const [currentPath, setCurrentPath] = useState<string>("");
  const [parentPath, setParentPath] = useState<string>("");
  const [items, setItems] = useState<FileTreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDraggingOverTree, setIsDraggingOverTree] = useState<boolean>(false);

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
      autoSave: true,
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
      const data = await fsTree(dirPath);
      if (data.items) {
        setItems(data.items);
        setCurrentPath(data.currentPath);
        setParentPath(data.parentPath);
      }
    } catch (e) {
      console.error("Failed to load file tree", e);
      setErrorMessage(e instanceof Error ? e.message : "Impossible de charger l'explorateur");
    } finally {
      setLoadingTree(false);
    }
  }, []);

  // Open / Read file by path
  const openFileByPath = useCallback(async (filePath: string) => {
    const existingIndex = tabs.findIndex((t) => t.path === filePath);
    if (existingIndex !== -1) {
      setActiveTabPath(filePath);
      return;
    }

    setLoadingFile(true);
    setErrorMessage(null);
    try {
      const data = await fsRead(filePath);
      if (data.content !== undefined) {
        const newTab: MonacoTab = {
          path: data.path,
          name: data.name,
          content: data.content,
          originalContent: data.content,
          extension: getMonacoLanguage(data.extension || ""),
          isDirty: false,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabPath(data.path);
      }
    } catch (e) {
      console.error("Failed to read file", e);
      setErrorMessage(e instanceof Error ? e.message : "Erreur lors de la lecture du fichier");
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setLoadingFile(false);
    }
  }, [tabs]);

  // Fetch initially or on folder change
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
        const closedIdx = tabs.findIndex((t) => t.path === filePath);
        const fallbackIdx = Math.min(closedIdx, nextTabs.length - 1);
        setActiveTabPath(nextTabs[fallbackIdx].path);
      } else {
        setActiveTabPath("");
      }
    }
  };

  // Save specific tab
  const handleSaveFile = async (targetPath: string) => {
    const tabToSave = tabs.find((t) => t.path === targetPath);
    if (!tabToSave) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      await fsWrite(targetPath, tabToSave.content);
      setTabs((prev) =>
        prev.map((t) =>
          t.path === targetPath
            ? { ...t, originalContent: t.content, isDirty: false }
            : t
        )
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error("Failed to save file", e);
      setErrorMessage(e instanceof Error ? e.message : "Impossible de sauvegarder le fichier");
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
        try {
          await fsWrite(t.path, t.content);
          setTabs((prev) =>
            prev.map((tab) =>
              tab.path === t.path
                ? { ...tab, originalContent: tab.content, isDirty: false }
                : tab
            )
          );
          successCount++;
        } catch (e) {
          console.error(`Failed to save ${t.path}`, e);
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

  // Debounced auto-save engine for professional remote editing
  useEffect(() => {
    if (!editorSettings.autoSave || !activeTabPath) return;
    const tab = tabs.find((t) => t.path === activeTabPath);
    if (!tab || !tab.isDirty) return;

    const timer = setTimeout(() => {
      handleSaveFile(activeTabPath);
    }, 1500);

    return () => clearTimeout(timer);
  }, [tabs, activeTabPath, editorSettings.autoSave]);

  // Create empty file or folder
  const handleCreateItem = async (isFile: boolean) => {
    const name = newItemName.trim();
    if (!name) return;

    const separator = currentPath.endsWith("/") ? "" : "/";
    const targetPath = `${currentPath}${separator}${name}`;

    try {
      if (isFile) {
        await fsCreateFile(targetPath);
      } else {
        await fsCreateDirectory(targetPath);
      }
      setNewItemName("");
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
      fetchTree(currentPath);
      if (isFile) {
        openFileByPath(targetPath);
      }
    } catch (e) {
      console.error("Failed to create filesystem item", e);
      alert(e instanceof Error ? e.message : "Erreur de création");
    }
  };

  // Rename handler
  const handleConfirmRename = async (item: FileTreeItem) => {
    const name = renameName.trim();
    if (!name || name === item.name) {
      setRenamingPath(null);
      return;
    }

    const separator = currentPath.endsWith("/") ? "" : "/";
    const newPath = `${currentPath}${separator}${name}`;

    try {
      await fsRename(item.path, newPath);
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
    } catch (e) {
      console.error("Rename failed", e);
      alert(e instanceof Error ? e.message : "Erreur lors du renommage");
    }
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    try {
      await fsDelete(deletingItem.path);
      setTabs((prev) => prev.filter((t) => t.path !== deletingItem.path));
      if (activeTabPath === deletingItem.path) {
        setActiveTabPath("");
      }
      setDeletingItem(null);
      fetchTree(currentPath);
    } catch (e) {
      console.error("Delete failed", e);
      alert(e instanceof Error ? e.message : "Erreur lors de la suppression");
    }
  };

  // Drag-and-Drop file uploading for direct files drops
  const handleDragOverTree = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverTree(true);
  };

  const handleDragLeaveTree = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverTree(false);
  };

  const handleDropTree = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverTree(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      setLoadingTree(true);
      try {
        for (const file of files) {
          const content = await readFileAsBase64(file);
          const separator = currentPath.endsWith("/") ? "" : "/";
          const targetPath = `${currentPath}${separator}${file.name}`;
          
          // Write avec encodage base64 (compatible Tauri et web)
          await fsWrite(targetPath, content, "base64");
        }
        fetchTree(currentPath);
      } catch (err) {
        console.error("Upload failed", err);
        setErrorMessage("Erreur lors de l'envoi du fichier.");
      } finally {
        setLoadingTree(false);
      }
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIdx = result.indexOf(",");
        if (commaIdx !== -1) {
          resolve(result.slice(commaIdx + 1));
        } else {
          resolve(result);
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
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
    <div id="monaco-file-editor-root" className="flex flex-1 h-full bg-[#030712] text-slate-200 overflow-hidden select-none">
      {/* Retractable Left Sidebar File Tree Drawer with fluid layout transition */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            id="explorer-sidebar-container"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="border-r border-slate-800/80 bg-slate-900/40 flex flex-col h-full shrink-0 relative overflow-hidden"
          >
            {/* Explorer header — système de fichiers local uniquement */}
            <div className="p-2 border-b border-slate-800 bg-slate-950/60 flex items-center gap-1.5 text-[10px]">
              <Laptop className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono font-bold text-slate-300">Système de fichiers local</span>
            </div>

            {/* Explorer Header Actions */}
            <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/10">
              <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                Navigateur
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
            <div className="px-3 py-1.5 bg-slate-950 font-mono text-[10px] text-slate-500 truncate border-b border-slate-800/40">
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
                    placeholder="index.html"
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
                    placeholder="public"
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

            {/* Search filter bar */}
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

            {/* Directory Items List & Drag-and-Drop Drop Zone */}
            <div
              id="directory-items-list"
              onDragOver={handleDragOverTree}
              onDragLeave={handleDragLeaveTree}
              onDrop={handleDropTree}
              className={`flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar relative ${
                isDraggingOverTree ? "bg-emerald-950/20 border-2 border-dashed border-emerald-500/50" : ""
              }`}
            >
              {isDraggingOverTree && (
                <div className="absolute inset-0 bg-[#091a14]/90 text-emerald-400 font-mono text-[10px] p-4 flex flex-col items-center justify-center text-center z-30 pointer-events-none">
                  <UploadCloud className="w-8 h-8 mb-1 animate-bounce text-emerald-400" />
                  <p className="font-bold">Déposer le fichier</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">Sera enregistré sous {getDisplayPath(currentPath)}</p>
                </div>
              )}

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
              
              {filteredItems.length === 0 && !loadingTree && (
                <div className="p-4 text-center text-[10px] text-slate-500 font-mono">
                  Dossier vide. Déposez des fichiers ici pour les téléverser.
                </div>
              )}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Monaco Editor View */}
      <div className="flex-1 flex flex-col h-full bg-[#030712] relative">
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
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#070b15] h-10 shrink-0 select-none px-2">
          {/* Collapse sidebar button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors mr-2"
            title={isSidebarOpen ? "Masquer le panneau" : "Afficher le panneau"}
          >
            <PanelLeft className="w-4 h-4 text-emerald-400" />
          </button>

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

                  {tab.isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  )}

                  <button
                    onClick={(e) => handleCloseTab(tab.path, e)}
                    className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
                    title="Fermer le fichier"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {tabs.length === 0 && (
              <span className="text-[10px] font-mono text-slate-500 px-3 py-1">
                Aucun fichier ouvert
              </span>
            )}
          </div>

          {/* Editor Header Toolbar Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {tabs.length > 0 && (
              <>
                <button
                  onClick={handleSaveAll}
                  className="px-2.5 py-1 text-[11px] bg-slate-900 hover:bg-slate-850 text-slate-300 font-mono border border-slate-700/80 rounded transition-colors flex items-center gap-1.5"
                  title="Enregistrer tout (Ctrl+Shift+S)"
                >
                  <Save className="w-3.5 h-3.5" />
                  Tout sauver
                </button>

                <button
                  onClick={() => handleSaveFile(activeTabPath)}
                  disabled={saving || !activeTab?.isDirty}
                  className="px-2.5 py-1 text-[11px] bg-emerald-600 disabled:bg-slate-900 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 disabled:text-slate-500 font-bold font-mono rounded transition-all flex items-center gap-1.5"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Sauvegarder
                </button>
              </>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded transition-all ${
                showSettings ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Paramètres de l'éditeur"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Monaco Editor Settings Drawer Panel */}
        {showSettings && (
          <div className="bg-[#0b0f19] border-b border-slate-800 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 z-20 text-xs font-mono">
            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase">Police</span>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1">
                <input
                  type="number"
                  value={editorSettings.fontSize}
                  onChange={(e) => updateSetting("fontSize", Math.max(10, Math.min(24, parseInt(e.target.value) || 12)))}
                  className="bg-transparent text-slate-200 w-full focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">px</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase">Retour à la ligne</span>
              <select
                value={editorSettings.wordWrap}
                onChange={(e) => updateSetting("wordWrap", e.target.value as "on" | "off")}
                className="bg-slate-950 text-slate-300 border border-slate-800 rounded px-2 py-1 w-full"
              >
                <option value="on">Activé</option>
                <option value="off">Désactivé</option>
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase">Minimap</span>
              <select
                value={editorSettings.minimap ? "true" : "false"}
                onChange={(e) => updateSetting("minimap", e.target.value === "true")}
                className="bg-slate-950 text-slate-300 border border-slate-800 rounded px-2 py-1 w-full"
              >
                <option value="true">Visible</option>
                <option value="false">Masqué</option>
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] uppercase">Sauvegarde Auto</span>
              <select
                value={editorSettings.autoSave ? "true" : "false"}
                onChange={(e) => updateSetting("autoSave", e.target.value === "true")}
                className="bg-slate-950 text-slate-300 border border-slate-800 rounded px-2 py-1 w-full"
              >
                <option value="true">Actif (1.5s)</option>
                <option value="false">Inactif</option>
              </select>
            </div>
          </div>
        )}

        {/* Editor canvas */}
        <div className="flex-1 w-full overflow-hidden relative">
          {loadingFile && (
            <div className="absolute inset-0 bg-[#030712]/75 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-emerald-400 font-mono text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              <span>Chargement du fichier en cours...</span>
            </div>
          )}

          {activeTab ? (
            <Editor
              height="100%"
              path={activeTab.path}
              language={activeTab.extension}
              theme={editorSettings.theme}
              value={activeTab.content}
              onChange={handleEditorChange}
              loading={
                <div className="text-emerald-400 font-mono text-xs flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Chargement du compilateur Monaco...
                </div>
              }
              options={{
                fontSize: editorSettings.fontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Consolas', monospace",
                wordWrap: editorSettings.wordWrap,
                minimap: { enabled: editorSettings.minimap },
                tabSize: editorSettings.tabSize,
                cursorBlinking: "smooth",
                roundedSelection: true,
                padding: { top: 8, bottom: 8 },
                automaticLayout: true,
                theme: "vs-dark"
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
              <FileCode className="w-12 h-12 text-slate-800 mb-2 animate-pulse" />
              <p className="font-semibold text-xs text-slate-400">Aucun fichier actif sélectionné</p>
              <p className="text-[10px] text-slate-600 mt-1 max-w-sm">
                Sélectionnez un fichier local ou SFTP dans le panneau de gauche pour commencer l'édition en direct avec sauvegarde asynchrone.
              </p>
              
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 text-[11px] rounded border border-slate-700/80 font-mono transition-colors"
                >
                  Ouvrir l'Explorateur
                </button>
                <button
                  onClick={() => {
                    setIsCreatingFile(true);
                    setIsSidebarOpen(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-[11px] rounded border border-emerald-500/20 font-mono transition-colors"
                >
                  Créer un nouveau fichier
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick run context bar */}
        {activeTab && (
          <div className="bg-[#070b15] border-t border-slate-800/80 px-4 py-1.5 h-8 shrink-0 flex items-center justify-between text-[10px] font-mono text-slate-400 select-none">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3 text-slate-500" />
                Langage: <span className="text-emerald-400 font-bold">{activeTab.extension.toUpperCase()}</span>
              </span>
              <span>
                Statut: {activeTab.isDirty ? <span className="text-amber-400">Modifié (Non enregistré)</span> : <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 inline text-emerald-400" /> Enregistré</span>}
              </span>
              {editorSettings.autoSave && (
                <span className="text-slate-500 text-[9px] bg-emerald-500/10 text-emerald-400 px-1 py-0.2 rounded border border-emerald-500/20">
                  Auto-Save actif
                </span>
              )}
            </div>

            <button
              onClick={() => {
                if (activeTab.extension === "shell" || activeTab.extension === "javascript" || activeTab.extension === "python") {
                  const cmd = activeTab.extension === "shell" 
                    ? `bash "${activeTab.path}"`
                    : activeTab.extension === "python"
                    ? `python3 "${activeTab.path}"`
                    : `node "${activeTab.path}"`;
                  onExecuteInTerminal(cmd);
                } else {
                  onExecuteInTerminal(`cat "${activeTab.path}"`);
                }
              }}
              className="flex items-center gap-1 hover:text-emerald-300 transition-colors"
              title="Exécuter ou afficher ce fichier dans le terminal de maintenance"
            >
              <TermIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exécuter dans le PTY</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
