import React, { useEffect, useState, useCallback } from "react";
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
  AlertCircle
} from "lucide-react";
import { FileTreeItem } from "../types";

interface MonacoFileEditorProps {
  onExecuteInTerminal: (command: string) => void;
  initialFilePath?: string;
}

export const MonacoFileEditor: React.FC<MonacoFileEditorProps> = ({
  onExecuteInTerminal,
  initialFilePath,
}) => {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [parentPath, setParentPath] = useState<string>("");
  const [items, setItems] = useState<FileTreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);

  const [activeFilePath, setActiveFilePath] = useState<string>("");
  const [activeFileName, setActiveFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [fileExtension, setFileExtension] = useState<string>("typescript");
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Load File Tree
  const fetchTree = useCallback(async (dirPath?: string) => {
    setLoadingTree(true);
    try {
      const url = dirPath ? `/api/fs/tree?path=${encodeURIComponent(dirPath)}` : "/api/fs/tree";
      const res = await fetch(url);
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        setCurrentPath(data.currentPath);
        setParentPath(data.parentPath);
      }
    } catch (e) {
      console.error("Failed to load file tree", e);
    } finally {
      setLoadingTree(false);
    }
  }, []);

  const loadFileByPath = async (filePath: string) => {
    setLoadingFile(true);
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.content !== undefined) {
        setActiveFilePath(data.path);
        setActiveFileName(data.name);
        setFileContent(data.content);
        setFileExtension(getMonacoLanguage(data.extension));
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e) {
      console.error("Failed to read file", e);
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    if (initialFilePath) {
      loadFileByPath(initialFilePath);
      const parentDir = initialFilePath.substring(0, initialFilePath.lastIndexOf("/")) || ".";
      fetchTree(parentDir);
    } else {
      fetchTree();
    }
  }, [initialFilePath, fetchTree]);

  // Open File into Monaco Editor
  const handleOpenFile = async (item: FileTreeItem) => {
    if (item.isDirectory) {
      fetchTree(item.path);
      return;
    }

    setLoadingFile(true);
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(item.path)}`);
      const data = await res.json();
      if (data.content !== undefined) {
        setActiveFilePath(data.path);
        setActiveFileName(data.name);
        setFileContent(data.content);
        setFileExtension(getMonacoLanguage(data.extension));
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e) {
      console.error("Failed to read file", e);
    } finally {
      setLoadingFile(false);
    }
  };

  // Save File Back to Disk
  const handleSaveFile = async () => {
    if (!activeFilePath) return;
    setSaving(true);
    try {
      const res = await fetch("/api/fs/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeFilePath, content: fileContent }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (e) {
      console.error("Failed to save file", e);
    } finally {
      setSaving(false);
    }
  };

  const getMonacoLanguage = (ext: string): string => {
    switch (ext) {
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
      default:
        return "plaintext";
    }
  };

  return (
    <div className="flex flex-1 h-full bg-slate-950 text-slate-200 overflow-hidden select-none">
      {/* Left File Explorer Panel */}
      <div className="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col h-full shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase font-mono">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            Explorateur
          </span>
          <button
            onClick={() => fetchTree(currentPath)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Rafraîchir les fichiers"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTree ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Current Path Breadcrumb */}
        <div className="px-3 py-1.5 bg-slate-950 font-mono text-[10px] text-slate-400 truncate border-b border-slate-800/80">
          {currentPath.replace(process.cwd(), ".")}
        </div>

        {/* Directory Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {parentPath && parentPath !== currentPath && (
            <button
              onClick={() => fetchTree(parentPath)}
              className="w-full text-left px-2 py-1.5 rounded text-xs text-emerald-400 hover:bg-slate-800/80 font-mono flex items-center gap-2"
            >
              <Folder className="w-3.5 h-3.5" /> .. (Dossier parent)
            </button>
          )}

          {items.map((item) => (
            <button
              key={item.path}
              onClick={() => handleOpenFile(item)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                activeFilePath === item.path
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                  : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {item.isDirectory ? (
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                )}
                <span className="truncate">{item.name}</span>
              </div>
              {!item.isDirectory && item.size > 0 && (
                <span className="text-[10px] font-mono text-slate-500">
                  {Math.round(item.size / 1024)}k
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right Monaco Editor View */}
      <div className="flex-1 flex flex-col h-full bg-slate-950">
        {activeFilePath ? (
          <>
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-200">{activeFileName}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {fileExtension}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onExecuteInTerminal(`cat "${activeFilePath}"`)}
                  className="px-2.5 py-1 text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded text-xs font-mono flex items-center gap-1.5 transition-colors"
                  title="Afficher dans le terminal avec cat"
                >
                  <TermIcon className="w-3.5 h-3.5 text-emerald-400" /> Cat dans Terminal
                </button>

                <button
                  onClick={handleSaveFile}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded text-xs font-semibold font-mono flex items-center gap-1.5 transition-all ${
                    saveSuccess
                      ? "bg-emerald-600 text-slate-950"
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

            {/* Monaco Editor Component */}
            <div className="flex-1 w-full h-full relative">
              {loadingFile ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-10 text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-400" />
                  Chargement du fichier dans Monaco Editor...
                </div>
              ) : null}

              <Editor
                height="100%"
                language={fileExtension}
                theme="vs-dark"
                value={fileContent}
                onChange={(value) => setFileContent(value || "")}
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: "on",
                  smoothScrolling: true,
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
              <FileCode className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-slate-300 mb-1">Monaco Code & File Editor</h3>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Sélectionnez n'importe quel fichier dans l'explorateur à gauche pour afficher et éditer son code en direct avec coloration syntaxique.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
