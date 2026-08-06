import React, { useEffect, useState } from "react";
import { FileCode2, Copy, Check, TerminalSquare, Braces, Database, LayoutGrid, Settings, CodeXml, Palette, BookOpen } from "lucide-react";
import { apiFetch } from "../lib/api";
import { isTauri, tauriInvoke } from "../lib/tauri";

/** Un onglet = une couche technologique du projet, avec ses VRAIS fichiers. */
interface ArchitectureTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  files: { key: string; label: string }[];
}

const TABS: ArchitectureTab[] = [
  {
    id: "rust",
    label: "Rust · Tauri",
    icon: <TerminalSquare className="w-4 h-4 text-emerald-400" />,
    description: "Backend natif desktop : sessions PTY, keyring OS, opérations FS, stats système.",
    files: [
      { key: "mainRs", label: "src-tauri/src/main.rs" },
      { key: "ptyRs", label: "src-tauri/src/pty.rs" },
      { key: "commandsRs", label: "src-tauri/src/commands.rs" },
      { key: "secretsRs", label: "src-tauri/src/secrets.rs" },
      { key: "fsRs", label: "src-tauri/src/fs.rs" },
      { key: "cargoToml", label: "src-tauri/Cargo.toml" },
      { key: "tauriConfJson", label: "src-tauri/tauri.conf.json" },
    ],
  },
  {
    id: "backend",
    label: "TypeScript · Express",
    icon: <Database className="w-4 h-4 text-blue-400" />,
    description: "Backend web fallback : API REST, auth JWT, WebSocket PTY, sécurité.",
    files: [
      { key: "serverTs", label: "server.ts" },
      { key: "routesTs", label: "src/backend/routes.ts" },
      { key: "authTs", label: "src/backend/auth.ts" },
      { key: "servicesTs", label: "src/backend/services.ts" },
      { key: "syncTs", label: "src/backend/sync.ts" },
      { key: "securityTs", label: "src/backend/security.ts" },
    ],
  },
  {
    id: "frontend",
    label: "React · TypeScript",
    icon: <Braces className="w-4 h-4 text-sky-400" />,
    description: "Frontend : terminal xterm.js, éditeur Monaco, adaptateurs Tauri/API.",
    files: [
      { key: "appTsx", label: "src/App.tsx" },
      { key: "mainTsx", label: "src/main.tsx" },
      { key: "apiTs", label: "src/lib/api.ts" },
      { key: "tauriTs", label: "src/lib/tauri.ts" },
      { key: "fsApiTs", label: "src/lib/fsApi.ts" },
      { key: "secureStorageTs", label: "src/lib/secureStorage.ts" },
      { key: "typesTs", label: "src/types.ts" },
    ],
  },
  {
    id: "config",
    label: "Config · CI",
    icon: <Settings className="w-4 h-4 text-amber-400" />,
    description: "Outillage : build Vite, TypeScript, workflows GitHub Actions.",
    files: [
      { key: "packageJson", label: "package.json" },
      { key: "viteConfigTs", label: "vite.config.ts" },
      { key: "tsconfigJson", label: "tsconfig.json" },
      { key: "rustYml", label: ".github/workflows/rust.yml" },
      { key: "webpackYml", label: ".github/workflows/webpack.yml" },
    ],
  },
  {
    id: "python",
    label: "Python · Scripts",
    icon: <CodeXml className="w-4 h-4 text-yellow-400" />,
    description: "Scripts d'outillage système en Python (stdlib uniquement, zéro dépendance).",
    files: [
      { key: "systemHealthPy", label: "scripts/python/system_health.py" },
      { key: "diskUsagePy", label: "scripts/python/disk_usage.py" },
    ],
  },
  {
    id: "css",
    label: "CSS · Tailwind",
    icon: <Palette className="w-4 h-4 text-pink-400" />,
    description: "Styles de l'application : Tailwind v4, thème sombre, composants UI.",
    files: [
      { key: "indexCss", label: "src/index.css" },
      { key: "indexHtml", label: "index.html" },
    ],
  },
  {
    id: "markdown",
    label: "Markdown · Docs",
    icon: <BookOpen className="w-4 h-4 text-violet-400" />,
    description: "Documentation du projet : README et politique de sécurité.",
    files: [
      { key: "readmeMd", label: "README.md" },
      { key: "securityMd", label: "SECURITY.md" },
    ],
  },
];

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
  { name: "fs_tree", args: "dir", desc: "Liste un dossier (2 Mo max, 300 items)" },
  { name: "fs_read", args: "path", desc: "Lit un fichier (2 Mo max)" },
  { name: "fs_write", args: "path, content, encoding", desc: "Écrit un fichier" },
  { name: "fs_create_file", args: "path", desc: "Crée un fichier vide" },
  { name: "fs_create_directory", args: "path", desc: "Crée un dossier" },
  { name: "fs_rename", args: "old_path, new_path", desc: "Renomme / déplace" },
  { name: "fs_delete", args: "path", desc: "Supprime fichier ou dossier" },
  { name: "check_port", args: "port", desc: "Bind test TCP réel (port libre ?)" },
  { name: "check_shells", args: "—", desc: "Audit réel des shells présents" },
];

/**
 * Panneau "Architectures" : onglets par langage (Rust, TypeScript,
 * React, Config/CI) affichant les VRAIS fichiers du projet.
 * Aucune donnée simulée — tout est lu depuis le disque.
 */
export const TauriRustArchitect: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("rust");
  const [sourceCode, setSourceCode] = useState<Record<string, string> | null>(null);
  const [activeKey, setActiveKey] = useState<string>("mainRs");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tab = TABS.find((t) => t.id === activeTab) || TABS[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSourceCode(null);
    setActiveKey(tab.files[0]?.key || "");
    (async () => {
      try {
        let data: Record<string, string>;
        if (isTauri()) {
          // En desktop : le code source est lu par Rust (aucun serveur HTTP)
          data = await tauriInvoke<Record<string, string>>("get_source_code", { group: activeTab });
        } else {
          const res = await apiFetch(`/api/tauri/source?group=${activeTab}`);
          data = await res.json();
        }
        if (!cancelled) setSourceCode(data);
      } catch (e) {
        if (!cancelled) {
          console.error(`Failed to load ${activeTab} source`, e);
          setError(`Impossible de charger le code source (${tab.label}).`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeContent = sourceCode ? sourceCode[activeKey] || "" : "";
  const activeLabel = tab.files.find((f) => f.key === activeKey)?.label || activeKey;

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
          <LayoutGrid className="w-5 h-5 text-emerald-400" />
          Architectures du projet
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Code source réel de chaque couche — les fichiers sont lus depuis le projet (aucune donnée simulée).
        </p>
      </div>

      {/* Onglets de langages */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-lg border transition-colors ${
              activeTab === t.id
                ? "bg-slate-800 border-slate-600 text-emerald-400"
                : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 mb-4">{tab.description}</p>

      {/* Commandes Tauri (onglet Rust uniquement) */}
      {activeTab === "rust" && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <TerminalSquare className="w-3.5 h-3.5 text-emerald-400" />
            Commandes Tauri enregistrées ({TAURI_COMMANDS.length})
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
      )}

      {/* Fichiers source de l'onglet actif */}
      <div className="flex flex-wrap gap-1 mb-3">
        {tab.files.map((f) => (
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
        ) : loading || !sourceCode ? (
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
