import React from "react";
import { History, ChevronDown, Trash2, Send } from "lucide-react";

interface TerminalCommandBarProps {
  inputCommand: string;
  setInputCommand: (v: string) => void;
  handleExecuteInputCommand: (cmdToSend?: string) => void;
  commandHistory: string[];
  showHistoryDropdown: boolean;
  setShowHistoryDropdown: (v: boolean) => void;
  clearHistory: () => void;
}

/** Barre de commande persistante : bouton historique (dropdown des
 *  commandes récentes) + champ d'injection rapide dans le PTY. */
export function TerminalCommandBar({
  inputCommand,
  setInputCommand,
  handleExecuteInputCommand,
  commandHistory,
  showHistoryDropdown,
  setShowHistoryDropdown,
  clearHistory,
}: TerminalCommandBarProps) {
  return (
    <div className="bg-slate-950 border-t border-slate-800/80 p-2 flex items-center gap-2 relative z-20">
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-700/80 transition-colors"
          title="Historique des commandes sauvegardées (localStorage)"
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Historique</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {/* Dropdown Menu */}
        {showHistoryDropdown && (
          <div className="absolute bottom-full left-0 mb-1 w-72 max-h-60 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden flex flex-col z-50">
            <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>COMMANDES RÉCENTES</span>
              <button
                onClick={clearHistory}
                className="text-red-400 hover:text-red-300 flex items-center gap-1"
                title="Effacer l'historique"
              >
                <Trash2 className="w-3 h-3" />
                Effacer
              </button>
            </div>

            <div className="overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
              {commandHistory.length > 0 ? (
                commandHistory.map((cmd, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setInputCommand(cmd);
                      handleExecuteInputCommand(cmd);
                    }}
                    className="px-2.5 py-1.5 rounded hover:bg-slate-800 text-xs font-mono text-emerald-300 cursor-pointer truncate flex items-center justify-between group"
                  >
                    <span className="truncate">{cmd}</span>
                    <Send className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-slate-500 text-xs font-mono">
                  Aucune commande enregistrée
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Command Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleExecuteInputCommand();
        }}
        className="flex-1 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          placeholder="Saisissez ou choisissez une commande à envoyer au PTY... ($ apt update, df -h, etc.)"
          className="flex-1 bg-slate-900 text-slate-100 placeholder-slate-500 px-3 py-1.5 rounded text-xs font-mono border border-slate-800 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!inputCommand.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold text-xs font-mono rounded transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exécuter</span>
        </button>
      </form>
    </div>
  );
}
