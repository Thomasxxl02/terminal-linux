import React from "react";
import {
  FolderOpen,
  Search,
  Check,
  Copy,
  Eraser,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { TERMINAL_THEMES } from "../constants/themes";

interface TerminalToolbarProps {
  session: { name: string; shell: string };
  isConnected: boolean;
  showExplorer: boolean;
  setShowExplorer: (v: boolean) => void;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  handleSearchNext: (e?: React.FormEvent) => void;
  handleSearchPrev: () => void;
  handleCopy: () => void;
  copied: boolean;
  handleInterrupt: () => void;
  handleClear: () => void;
  fontSize: number;
  setFontSize: (v: number) => void;
  activeThemeId: string;
  onThemeChange: (id: string) => void;
}

/** Barre d'outils du terminal : état de connexion, actions (copie,
 *  SIGINT, effacement, recherche), taille de police et thème. */
export function TerminalToolbar({
  session,
  isConnected,
  showExplorer,
  setShowExplorer,
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery,
  handleSearchNext,
  handleSearchPrev,
  handleCopy,
  copied,
  handleInterrupt,
  handleClear,
  fontSize,
  setFontSize,
  activeThemeId,
  onThemeChange,
}: TerminalToolbarProps) {
  return (
    <>
      {/* Terminal Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/80 text-xs text-slate-300">
        {/* Left Status & Session Name */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="font-mono text-slate-200 font-medium text-xs">
            {session.name}
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
            {session.shell}
          </span>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Synchronized CWD Explorer Toggle */}
          <button
            onClick={() => setShowExplorer(!showExplorer)}
            className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors ${
              showExplorer
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
            title="Afficher/Masquer l'explorateur de fichiers synchronisé CWD"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Explorateur CWD</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded transition-colors ${
              showSearch
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title="Rechercher dans le terminal"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Copy Selection */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
            title="Copier la sélection (ou Ctrl+C)"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Send Interrupt Ctrl+C */}
          <button
            onClick={handleInterrupt}
            className="px-2 py-1 text-[11px] font-mono font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors"
            title="Envoyer SIGINT (Ctrl+C)"
          >
            Ctrl+C
          </button>

          {/* Clear Screen */}
          <button
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Effacer l'écran"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Font Size Adjusters */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-1">
            <button
              onClick={() => setFontSize(Math.max(10, fontSize - 1))}
              className="p-1 text-slate-400 hover:text-slate-200"
              title="Diminuer la police"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono px-1.5 text-slate-300">
              {fontSize}px
            </span>
            <button
              onClick={() => setFontSize(Math.min(24, fontSize + 1))}
              className="p-1 text-slate-400 hover:text-slate-200"
              title="Agrandir la police"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Theme Dropdown Selector */}
          <select
            value={activeThemeId}
            onChange={(e) => onThemeChange(e.target.value)}
            className="bg-slate-900 text-slate-300 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-emerald-500"
          >
            {TERMINAL_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Floating Search Bar */}
      {showSearch && (
        <form
          onSubmit={handleSearchNext}
          className="flex items-center gap-2 p-2 bg-slate-900 border-b border-slate-800 text-xs shadow-md z-10"
        >
          <Search className="w-4 h-4 text-emerald-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans l'historique terminal..."
            className="flex-1 bg-slate-950 text-slate-100 px-2.5 py-1 rounded border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono text-xs"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSearchPrev}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px]"
          >
            Précédent
          </button>
          <button
            type="submit"
            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded font-mono text-[11px]"
          >
            Suivant
          </button>
          <button
            type="button"
            onClick={() => setShowSearch(false)}
            className="px-2 py-1 text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </form>
      )}
    </>
  );
}
