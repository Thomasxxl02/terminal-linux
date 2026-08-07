import React from "react";
import { Folder, FolderOpen, FileCode, RefreshCw, ArrowRight } from "lucide-react";
import { FileTreeItem } from "../types";

interface TerminalExplorerProps {
  explorerPath: string;
  explorerParent: string;
  fileItems: FileTreeItem[];
  loadingExplorer: boolean;
  isTruncated: boolean;
  totalItemsCount: number;
  onNavigate: (dir: string) => void;
  onRefresh: () => void;
  onOpenMonacoFile?: (path: string) => void;
  onInjectPath: (path: string) => void;
}

/**
 * Explorateur CWD synchronisé (extrait de TerminalView) : arborescence du
 * répertoire courant, navigation parent, édition Monaco et injection de
 * chemin dans le PTY.
 */
export const TerminalExplorer: React.FC<TerminalExplorerProps> = ({
  explorerPath,
  explorerParent,
  fileItems,
  loadingExplorer,
  isTruncated,
  totalItemsCount,
  onNavigate,
  onRefresh,
  onOpenMonacoFile,
  onInjectPath,
}) => {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 z-10 text-xs text-slate-300 select-none">
      {/* Header */}
      <div className="p-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <span className="font-semibold text-slate-200 flex items-center gap-1.5 font-mono text-[11px] uppercase">
          <FolderOpen className="w-4 h-4 text-emerald-400" />
          Explorateur CWD
        </span>
        <button
          onClick={onRefresh}
          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Rafraîchir"
          aria-label="Rafraîchir l'explorateur"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingExplorer ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Path Indicator */}
      <div className="px-2.5 py-1.5 bg-slate-950 font-mono text-[10px] text-slate-400 border-b border-slate-800/80 flex items-center justify-between gap-1">
        <span className="truncate">{explorerPath}</span>
        {isTruncated && (
          <span
            className="shrink-0 text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded"
            title={`Dossier volumineux : 300 / ${totalItemsCount} éléments affichés`}
          >
            300/{totalItemsCount}
          </span>
        )}
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
        {explorerParent && explorerParent !== explorerPath && (
          <button
            onClick={() => onNavigate(explorerParent)}
            className="w-full text-left px-2 py-1.5 rounded text-[11px] text-emerald-400 hover:bg-slate-800 font-mono flex items-center gap-2"
          >
            <Folder className="w-3.5 h-3.5" /> .. (Dossier parent)
          </button>
        )}

        {fileItems.map((item) => (
          <div
            key={item.path}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", item.path);
            }}
            onClick={() => {
              if (item.isDirectory) {
                onNavigate(item.path);
              }
            }}
            className={`group w-full px-2 py-1.5 rounded text-[11px] flex items-center justify-between transition-colors cursor-pointer ${
              item.isDirectory
                ? "hover:bg-amber-500/10 text-amber-200"
                : "hover:bg-slate-800 text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              {item.isDirectory ? (
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              )}
              <span className="truncate">{item.name}</span>
            </div>

            {/* Action Icons on Hover */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
              {!item.isDirectory && onOpenMonacoFile && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMonacoFile(item.path);
                  }}
                  className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded"
                  title="Éditer dans Monaco"
                  aria-label="Éditer dans Monaco"
                >
                  <FileCode className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onInjectPath(`"${item.path}" `);
                }}
                className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-slate-700 rounded"
                title="Injecter le chemin dans le PTY"
                aria-label="Injecter le chemin dans le PTY"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {fileItems.length === 0 && !loadingExplorer && (
          <div className="p-3 text-center text-[10px] text-slate-500 font-mono">Dossier vide</div>
        )}
      </div>
    </div>
  );
};
