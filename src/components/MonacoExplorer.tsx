import React from "react";
import {
  FolderOpen,
  FilePlus,
  FolderPlus,
  RefreshCw,
  Folder,
  FileCode,
  UploadCloud,
  Check,
  X,
  Edit3,
  Trash2,
  AlertCircle,
  Laptop,
  Search,
} from "lucide-react";
import { FileTreeItem } from "../types";

export const getDisplayPath = (fullPath: string): string => {
  if (!fullPath) return "";
  try {
    if (typeof process !== "undefined" && typeof process.cwd === "function") {
      return fullPath.replace(process.cwd(), ".");
    }
  } catch {
    // ignore — fallback chemin brut
  }
  return fullPath;
};

export interface MonacoExplorerProps {
  currentPath: string;
  parentPath: string;
  items: FileTreeItem[];
  loadingTree: boolean;
  searchQuery: string;
  isDraggingOverTree: boolean;
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  newItemName: string;
  renamingPath: string | null;
  renameName: string;
  deletingItem: FileTreeItem | null;
  activeTabPath: string;

  onSetCreatingFile: (v: boolean) => void;
  onSetCreatingFolder: (v: boolean) => void;
  onSetNewItemName: (v: string) => void;
  onSetRenamingPath: (v: string | null) => void;
  onSetRenameName: (v: string) => void;
  onSetDeletingItem: (v: FileTreeItem | null) => void;
  onSetSearchQuery: (v: string) => void;
  onSetDraggingOverTree: (v: boolean) => void;

  onFetchTree: (dir?: string) => void;
  onItemClick: (item: FileTreeItem) => void;
  onCreateItem: (isFile: boolean) => void;
  onConfirmRename: (item: FileTreeItem) => void;
  onConfirmDelete: () => void;
  onDragOverTree: (e: React.DragEvent) => void;
  onDragLeaveTree: (e: React.DragEvent) => void;
  onDropTree: (e: React.DragEvent) => void;
}

/**
 * Explorateur de fichiers local (extrait de MonacoFileEditor).
 * Présentation pure : tous les états et handlers viennent du parent.
 */
export const MonacoExplorer: React.FC<MonacoExplorerProps> = ({
  currentPath,
  parentPath,
  items,
  loadingTree,
  searchQuery,
  isDraggingOverTree,
  isCreatingFile,
  isCreatingFolder,
  newItemName,
  renamingPath,
  renameName,
  deletingItem,
  activeTabPath,

  onSetCreatingFile,
  onSetCreatingFolder,
  onSetNewItemName,
  onSetRenamingPath,
  onSetRenameName,
  onSetDeletingItem,
  onSetSearchQuery,
  onSetDraggingOverTree,

  onFetchTree,
  onItemClick,
  onCreateItem,
  onConfirmRename,
  onConfirmDelete,
  onDragOverTree,
  onDragLeaveTree,
  onDropTree,
}) => {
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    return !q || item.name.toLowerCase().includes(q);
  });

  return (
    <>
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
              onSetCreatingFile(true);
              onSetCreatingFolder(false);
              onSetNewItemName("");
            }}
            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 rounded transition-colors"
            title="Nouveau fichier"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              onSetCreatingFolder(true);
              onSetCreatingFile(false);
              onSetNewItemName("");
            }}
            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 rounded transition-colors"
            title="Nouveau dossier"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onFetchTree(currentPath)}
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
              onChange={(e) => onSetNewItemName(e.target.value)}
              placeholder="index.html"
              className="flex-1 bg-slate-900 border border-slate-700/80 text-slate-100 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreateItem(true);
                if (e.key === "Escape") onSetCreatingFile(false);
              }}
            />
            <button
              onClick={() => onCreateItem(true)}
              className="p-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetCreatingFile(false)}
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
            <FolderPlus className="w-3 h-3 text-amber-400" /> Nouveau dossier
          </span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => onSetNewItemName(e.target.value)}
              placeholder="nouveau-dossier"
              className="flex-1 bg-slate-900 border border-slate-700/80 text-slate-100 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreateItem(false);
                if (e.key === "Escape") onSetCreatingFolder(false);
              }}
            />
            <button
              onClick={() => onCreateItem(false)}
              className="p-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetCreatingFolder(false)}
              className="p-1 bg-slate-850 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Search filter bar */}
      <div className="p-2 border-b border-slate-800/60 bg-slate-950/40">
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 py-1">
          <Search className="w-3 h-3 text-slate-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSetSearchQuery(e.target.value)}
            placeholder="Filtrer les fichiers..."
            className="bg-transparent text-slate-300 text-[10px] w-full focus:outline-none placeholder:text-slate-600 font-mono"
          />
        </div>
      </div>

      {/* Directory Items List & Drag-and-Drop Drop Zone */}
      <div
        onDragOver={onDragOverTree}
        onDragLeave={onDragLeaveTree}
        onDrop={onDropTree}
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
            onClick={() => onFetchTree(parentPath)}
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
                    onChange={(e) => onSetRenameName(e.target.value)}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-700 text-slate-100 rounded px-1 py-0.5 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        onConfirmRename(item);
                      }
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        onSetRenamingPath(null);
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmRename(item);
                    }}
                    className="p-0.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded transition-colors shrink-0"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetRenamingPath(null);
                    }}
                    className="p-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => onItemClick(item)}
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
                        onSetRenamingPath(item.path);
                        onSetRenameName(item.name);
                      }}
                      className="p-0.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-850 rounded"
                      title="Renommer"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetDeletingItem(item);
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
              onClick={() => onSetDeletingItem(null)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={onConfirmDelete}
              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
