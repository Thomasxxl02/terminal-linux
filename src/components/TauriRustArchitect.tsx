import React, { useEffect, useState } from "react";
import { FileCode2, Copy, Check, TerminalSquare } from "lucide-react";
import { apiFetch } from "../lib/api";
import { isTauri, tauriInvoke } from "../lib/tauri";

interface TauriSourceCode {
  cargoToml: string;
  mainRs: string;
  ptyRs: string;
  commandsRs: string;
  secretsRs: string;
  tauriConfJson: string;
}

/** Commandes Tauri réellement enregistrées dans src-tauri/src/main.rs */
const TAURI_COMMANDS: { name: string; args: string; desc: string }[] = [
  { name: "create_pty_session", args: "name, cols, rows", desc: "Crée une session PTY (shell natif)" },
  { name: "list_pty_sessions", args: "—", desc: "Liste les sessions PTY actives" },
  { name: "write_pty_input", args: "session_id, data", desc: "Écrit l'entrée clavier dans le shell" },
  { name: "resize_pty_session", args: "session_id, cols, rows", desc: "Redimensionne le terminal" },
  { name: "close_pty_session", args: "session_id", desc: "Ferme la session et tue le shell" },
  { name: "get_system_stats", args: "—", desc: "Stats système (lecture /proc directe)" },
  { name: "secure_set", args: "key, value", desc: "Stocke un secret dans le keyring OS" },
  { name: "secure_get", args: "key", desc: "Lit un secret du keyring OS" },
  { name: "secure_delete", args: "key", desc: "Supprime un secret du keyring OS" },
];

const FILE_LABELS: { key: keyof TauriSourceCode; label: string }[] = [
  { key: "mainRs", label: "src-tauri/src/main.rs" },
  { key: "ptyRs", label: "src-tauri/src/pty.rs" },
  { key: "commandsRs", label: "src-tauri/src/commands.rs" },
  { key: "secretsRs", label: "src-tauri/src/secrets.rs" },
  { key: "cargoToml", label: "src-tauri/Cargo.toml" },
  { key: "tauriConfJson", label: "src-tauri/tauri.conf.json" },
];

/**
 * Panneau "Architecture Rust" : affiche les VRAIS fichiers source du backend
 * Tauri et les commandes réellement enregistrées. Aucune donnée simulée.
 */
export const TauriRustArchitect: React.FC = () => {
  const [sourceCode, setSourceCode] = useState<TauriSourceCode | null>(null);
  const [activeKey, setActiveKey] = useState<keyof TauriSourceCode>("mainRs");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let data: TauriSourceCode;
        if (isTauri()) {
          // En desktop : le code source est lu par Rust (aucun serveur HTTP)
          data = await tauriInvoke<TauriSourceCode>("get_source_code");
        } else {
          const res = await apiFetch("/api/tauri/source");
          data = await res.json();
        }
        if (!cancelled) setSourceCode(data);
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load Rust source", e);
          setError("Impossible de charger le code source Rust.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeContent = sourceCode ? sourceCode[activeKey] || "" : "";
  const activeLabel = FILE_LABELS.find((f) => f.key === activeKey)?.label || activeKey;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible — ignorer silencieusement
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 p-6 overflow-y-auto custom-scrollbar">
      <div className="mb-6 pb-4 border-b border-slate-900">
        <h2 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <TerminalSquare className="w-5 h-5 text-emerald-400" />
          Architecture Rust du backend Tauri
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Code source réel du backend natif — les fichiers sont lus depuis le projet (aucune donnée simulée).
        </p>
      </div>

      {/* Commandes Tauri enregistrées */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <TerminalSquare className="w-3.5 h-3.5 text-emerald-400" />
          Commandes Tauri enregistrées
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {TAURI_COMMANDS.map((cmd) => (
            <div key={cmd.name} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <code className="text-[11px] font-mono text-emerald-400">{cmd.name}</code>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">({cmd.args})</div>
              <div className="text-[11px] text-slate-400 mt-1">{cmd.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fichiers source */}
      <div className="flex flex-wrap gap-1 mb-3">
        {FILE_LABELS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveKey(f.key)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded border transition-colors ${
              activeKey === f.key
                ? "bg-slate-800 border-slate-600 text-emerald-400"
                : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {f.label.split("/").pop()}
          </button>
        ))}
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 border-b border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
            <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
            {activeLabel}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 rounded transition-colors"
            title="Copier ce fichier"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>
        {error ? (
          <div className="p-6 text-sm text-red-400">{error}</div>
        ) : !sourceCode ? (
          <div className="p-6 text-sm text-slate-500 font-mono animate-pulse">Chargement du code source…</div>
        ) : (
          <pre className="p-4 text-[11px] leading-relaxed font-mono text-slate-300 overflow-x-auto max-h-[480px] custom-scrollbar whitespace-pre">
            {activeContent}
          </pre>
        )}
      </div>
    </div>
  );
};
