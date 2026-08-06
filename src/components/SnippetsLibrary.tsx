import React, { useState, useEffect } from "react";
import {
  Bookmark,
  Play,
  Copy,
  Check,
  Terminal,
  Search,
  Plus,
  Trash2,
  ListFilter,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FolderPlus,
  ArrowUpRight
} from "lucide-react";
import { COMMAND_SNIPPETS } from "../constants/snippets";
import { CommandSnippet } from "../types";

interface SnippetsLibraryProps {
  onExecuteInTerminal: (command: string) => void;
}

export const SnippetsLibrary: React.FC<SnippetsLibraryProps> = ({
  onExecuteInTerminal,
}) => {
  const [filter, setFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Custom interactive snippets list with storage
  const [snippets, setSnippets] = useState<CommandSnippet[]>([]);
  
  // Composer Workspace (Pipeline Composer)
  const [composedPipeline, setComposedPipeline] = useState<string[]>([]);
  const [pipelineSeparator, setPipelineSeparator] = useState(" && ");

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCmd, setNewCmd] = useState("");
  const [newCat, setNewCat] = useState("Perso");

  // Load merged list on init
  useEffect(() => {
    const saved = localStorage.getItem("terminal_custom_snippets");
    let parsedCustom: CommandSnippet[] = [];
    if (saved) {
      try {
        parsedCustom = JSON.parse(saved);
      } catch (e) {
        console.error("Error loading custom snippets", e);
      }
    }
    setSnippets([...COMMAND_SNIPPETS, ...parsedCustom]);
  }, []);

  const saveCustomSnippets = (allSnippets: CommandSnippet[]) => {
    // Save only custom snippets to localStorage
    const defaultIds = COMMAND_SNIPPETS.map(s => s.id);
    const customsOnly = allSnippets.filter(s => !defaultIds.includes(s.id));
    localStorage.setItem("terminal_custom_snippets", JSON.stringify(customsOnly));
    setSnippets(allSnippets);
  };

  const handleCopy = async (command: string, id: string) => {
    await navigator.clipboard.writeText(command);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCmd.trim()) return;

    const newSnippet: CommandSnippet = {
      id: `custom_snip_${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || "Snippet personnalisé créé par l'utilisateur.",
      command: newCmd.trim(),
      category: newCat.trim() || "Perso"
    };

    const updated = [...snippets, newSnippet];
    saveCustomSnippets(updated);

    // Reset fields
    setNewTitle("");
    setNewDesc("");
    setNewCmd("");
    setNewCat("Perso");
  };

  const handleDeleteSnippet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = snippets.filter(s => s.id !== id);
    saveCustomSnippets(updated);
    // Remove from pipeline too
    const targetCommand = snippets.find(s => s.id === id)?.command;
    if (targetCommand) {
      setComposedPipeline(prev => prev.filter(c => c !== targetCommand));
    }
  };

  // Pipeline manager helpers
  const togglePipelineCommand = (command: string) => {
    if (composedPipeline.includes(command)) {
      setComposedPipeline(prev => prev.filter(c => c !== command));
    } else {
      setComposedPipeline(prev => [...prev, command]);
    }
  };

  const clearPipeline = () => setComposedPipeline([]);

  const executePipeline = () => {
    if (composedPipeline.length === 0) return;
    const finalCommand = composedPipeline.join(pipelineSeparator);
    onExecuteInTerminal(finalCommand);
  };

  const copyPipeline = async () => {
    if (composedPipeline.length === 0) return;
    const finalCommand = composedPipeline.join(pipelineSeparator);
    await navigator.clipboard.writeText(finalCommand);
    setCopiedId("pipeline_copy");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter snippets based on search input & category pills
  const filteredSnippets = snippets.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(filter.toLowerCase()) ||
      s.command.toLowerCase().includes(filter.toLowerCase()) ||
      s.category.toLowerCase().includes(filter.toLowerCase());
    
    if (selectedCategory === "Tous") return matchesSearch;
    if (selectedCategory === "Perso / Customs") {
      // Custom ones are defined by ids starts with custom_
      return matchesSearch && s.id.startsWith("custom_");
    }
    return matchesSearch && s.category === selectedCategory;
  });

  // Extract list of all unique categories
  const categories = ["Tous", "Système", "Réseau", "Développement", "Stockage", "Docker", "Perso / Customs"];

  return (
    <div className="flex-1 bg-slate-950 text-slate-200 p-6 overflow-y-auto custom-scrollbar space-y-6 select-none">
      
      {/* Top Header & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shadow-inner shrink-0">
            <Bookmark className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Bibliothèque de Snippets Shell Linux
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Workspace
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Organisez vos scripts, assemblez-les dans un séquenceur de commandes avancé et injectez-les directement dans vos terminaux actifs.
            </p>
          </div>
        </div>

        {/* Search Input Filter */}
        <div className="relative min-w-[280px] self-stretch lg:self-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Filtrer les snippets..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Categories Horizontal Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 custom-scrollbar border-b border-slate-900">
        <ListFilter className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Core Grid split: Snippets list vs Composer Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Snippets Grid */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Snippets Disponibles ({filteredSnippets.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">Cliquez sur un snippet pour l'ajouter au séquenceur</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSnippets.map((snippet) => {
              const isSelectedInComposer = composedPipeline.includes(snippet.command);
              const isCustom = snippet.id.startsWith("custom_");
              return (
                <div
                  key={snippet.id}
                  onClick={() => togglePipelineCommand(snippet.command)}
                  className={`cursor-pointer bg-slate-900 border rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                    isSelectedInComposer
                      ? "border-emerald-500/50 bg-emerald-950/10"
                      : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                          {snippet.category}
                        </span>
                        {isCustom && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-850 font-semibold">
                            Custom
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(snippet.command, snippet.id);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800"
                          title="Copier la commande"
                        >
                          {copiedId === snippet.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {isCustom && (
                          <button
                            onClick={(e) => handleDeleteSnippet(snippet.id, e)}
                            className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-red-500/10"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="font-bold text-xs text-slate-100 mt-1">{snippet.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      {snippet.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <code className="block p-2 bg-slate-950 rounded font-mono text-[10px] text-emerald-400/95 truncate border border-slate-900">
                      $ {snippet.command}
                    </code>
                    
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{isSelectedInComposer ? "Sélectionné" : "Ajouter au séquenceur"}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExecuteInTerminal(snippet.command);
                        }}
                        className="py-1 px-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold rounded border border-emerald-500/20 hover:border-transparent transition-all flex items-center gap-1"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" /> Exécuter dans le Terminal
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredSnippets.length === 0 && (
              <div className="col-span-2 text-center py-12 bg-slate-900/30 border border-slate-850 rounded-xl">
                <p className="text-sm text-slate-500">Aucun snippet trouvé.</p>
                <button
                  onClick={() => { setFilter(""); setSelectedCategory("Tous"); }}
                  className="mt-3 text-xs text-emerald-400 hover:underline font-semibold"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Interactive Sequencer Composer & Custom Snippet Creator */}
        <div className="space-y-6">
          
          {/* Compound Command Pipeline Sequencer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="font-bold text-xs text-slate-100 uppercase tracking-wider">Séquenceur de Bash</h4>
                  <p className="text-[9px] text-slate-500">Assemblez plusieurs commandes en cascade.</p>
                </div>
              </div>
              
              {composedPipeline.length > 0 && (
                <button
                  onClick={clearPipeline}
                  className="text-[10px] text-red-400 hover:underline font-semibold"
                >
                  Vider ({composedPipeline.length})
                </button>
              )}
            </div>

            {/* Selection queue list */}
            <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar">
              {composedPipeline.map((cmd, idx) => (
                <div key={idx} className="p-2 bg-slate-950 rounded border border-slate-850 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">{idx + 1}</span>
                    <span className="text-[10px] text-slate-300 truncate">{cmd}</span>
                  </div>
                  <button
                    onClick={() => togglePipelineCommand(cmd)}
                    className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-900 shrink-0 ml-2"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {composedPipeline.length === 0 && (
                <div className="text-center p-6 text-slate-600 text-xs">
                  <p>Aucun snippet sélectionné.</p>
                  <p className="text-[10px] text-slate-500 mt-1">Cliquez sur les cartes de gauche pour composer votre script cascade.</p>
                </div>
              )}
            </div>

            {/* Separator toggle */}
            {composedPipeline.length > 1 && (
              <div className="flex items-center justify-between text-[11px] bg-slate-950 p-2 border border-slate-850 rounded-lg">
                <span className="text-slate-400">Opérateur de jonction :</span>
                <div className="flex gap-1.5">
                  {[
                    { label: "ET (&&)", val: " && " },
                    { label: "ALORS (;)", val: " ; " },
                    { label: "PIPE (|)", val: " | " }
                  ].map((sep) => (
                    <button
                      key={sep.val}
                      onClick={() => setPipelineSeparator(sep.val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        pipelineSeparator === sep.val
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-slate-900 text-slate-500 border-transparent hover:text-slate-300"
                      }`}
                    >
                      {sep.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generated multi-command preview & trigger */}
            {composedPipeline.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-slate-850">
                <span className="text-[9px] uppercase font-bold text-slate-400">Aperçu du Pipeline Composé</span>
                <div className="p-2.5 bg-slate-950 rounded font-mono text-[10px] text-emerald-400 break-all max-h-[80px] overflow-y-auto border border-slate-900">
                  $ {composedPipeline.join(pipelineSeparator)}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={copyPipeline}
                    className="py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    {copiedId === "pipeline_copy" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copier Séquence
                      </>
                    )}
                  </button>
                  <button
                    onClick={executePipeline}
                    className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Injecter Séquence
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* New Custom Snippet Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-850 pb-2.5">
              <FolderPlus className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="font-bold text-xs text-slate-100 uppercase tracking-wider">Créateur de Snippets</h4>
                <p className="text-[9px] text-slate-500 font-medium">Enregistrez un raccourci réutilisable.</p>
              </div>
            </div>

            <form onSubmit={handleAddSnippet} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Titre du snippet :</label>
                <input
                  type="text"
                  placeholder="ex: Nettoyage logs systemd"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">Catégorie :</label>
                  <input
                    type="text"
                    placeholder="ex: Docker, Git"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">Tags / Description :</label>
                  <input
                    type="text"
                    placeholder="ex: Libère de la place"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500 text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Commande Shell :</label>
                <textarea
                  placeholder="ex: journalctl --vacuum-time=7d"
                  value={newCmd}
                  onChange={(e) => setNewCmd(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 font-mono border border-slate-800 rounded px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500 text-emerald-400"
                />
              </div>

              <button
                type="submit"
                disabled={!newTitle.trim() || !newCmd.trim()}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Enregistrer le Snippet
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
};
