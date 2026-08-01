import React, { useState } from "react";
import { Bookmark, Play, Copy, Check, Terminal, Search } from "lucide-react";
import { COMMAND_SNIPPETS } from "../constants/snippets";

interface SnippetsLibraryProps {
  onExecuteInTerminal: (command: string) => void;
}

export const SnippetsLibrary: React.FC<SnippetsLibraryProps> = ({
  onExecuteInTerminal,
}) => {
  const [filter, setFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredSnippets = COMMAND_SNIPPETS.filter(
    (s) =>
      s.title.toLowerCase().includes(filter.toLowerCase()) ||
      s.command.toLowerCase().includes(filter.toLowerCase()) ||
      s.category.toLowerCase().includes(filter.toLowerCase())
  );

  const handleCopy = async (command: string, id: string) => {
    await navigator.clipboard.writeText(command);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-200 p-6 overflow-y-auto custom-scrollbar space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg">
            <Bookmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">
              Bibliothèque de Snippets Shell Linux
            </h2>
            <p className="text-xs text-slate-400">
              Raccourcis de commandes fréquentes pour l'administration et le débogage système.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filtrer les snippets..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSnippets.map((snippet) => (
          <div
            key={snippet.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {snippet.category}
                </span>
                <button
                  onClick={() => handleCopy(snippet.command, snippet.id)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                  title="Copier la commande"
                >
                  {copiedId === snippet.id ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <h3 className="font-semibold text-sm text-slate-100">{snippet.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{snippet.description}</p>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-950 rounded font-mono text-[11px] text-emerald-400/90 break-all border border-slate-800/80">
                $ {snippet.command}
              </div>

              <button
                onClick={() => onExecuteInTerminal(snippet.command)}
                className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-semibold text-xs rounded-lg border border-emerald-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Exécuter dans le Terminal
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
