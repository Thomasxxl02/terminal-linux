import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Box,
  Copy,
  Check,
  Download,
  Terminal as TermIcon,
  Shield,
  Layers,
  Zap,
  Cpu,
  FileCode,
  BookOpen
} from "lucide-react";
import { TauriSourceCode } from "../types";

export const TauriRustArchitect: React.FC = () => {
  const [sourceCode, setSourceCode] = useState<TauriSourceCode | null>(null);
  const [activeTab, setActiveTab] = useState<"cargo" | "main" | "pty" | "conf">("pty");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/tauri/source")
      .then((res) => res.json())
      .then((data) => setSourceCode(data))
      .catch((e) => console.error("Failed to fetch Tauri source code", e));
  }, []);

  const getActiveCode = () => {
    if (!sourceCode) return "// Chargement du code source Rust...";
    switch (activeTab) {
      case "cargo":
        return sourceCode.cargoToml;
      case "main":
        return sourceCode.mainRs;
      case "pty":
        return sourceCode.ptyRs;
      case "conf":
        return sourceCode.tauriConfJson;
      default:
        return "";
    }
  };

  const getActiveLanguage = () => {
    if (activeTab === "cargo" || activeTab === "conf") return "toml";
    if (activeTab === "main" || activeTab === "pty") return "rust";
    return "plaintext";
  };

  const handleCopy = async () => {
    const code = getActiveCode();
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-slate-950 text-slate-200 overflow-hidden select-none p-6 space-y-6">
      {/* Architecture Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg">
            <Box className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Architecture Tauri & Backend Rust (`portable-pty`)
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                Rust v1.75+ / Tauri v1.5
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Spécification technique de l'émulateur desktop natif avec communication PTY asynchrone non-bloquante et xterm.js.
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Code Copié !" : "Copier ce fichier Rust"}
        </button>
      </div>

      {/* Technical Architecture Specs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-amber-400 mb-1 font-semibold text-xs">
            <Box className="w-4 h-4" /> Framework Desktop
          </div>
          <div className="text-sm font-bold text-slate-100">Tauri v1.5</div>
          <div className="text-[11px] text-slate-400 mt-1">Empreinte mémoire &lt; 30MB, sécurité IPC binaire.</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-emerald-400 mb-1 font-semibold text-xs">
            <Cpu className="w-4 h-4" /> Backend PTY
          </div>
          <div className="text-sm font-bold text-slate-100">portable-pty Crate</div>
          <div className="text-[11px] text-slate-400 mt-1">Bridge sous-processus PTY multi-thread asynchrone.</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-cyan-400 mb-1 font-semibold text-xs">
            <Zap className="w-4 h-4" /> Frontend Web
          </div>
          <div className="text-sm font-bold text-slate-100">xterm.js + WebGL</div>
          <div className="text-[11px] text-slate-400 mt-1">Rendu ANSI 60 FPS avec addons fit et WebGL.</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-purple-400 mb-1 font-semibold text-xs">
            <Shield className="w-4 h-4" /> IPC Bidirectionnel
          </div>
          <div className="text-sm font-bold text-slate-100">Tauri Commands</div>
          <div className="text-[11px] text-slate-400 mt-1">IPC `invoke` et émission d'évènements `emit`.</div>
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
        {/* File Tabs */}
        <div className="flex items-center justify-between bg-slate-950 px-4 py-2 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1 font-mono">
            <button
              onClick={() => setActiveTab("pty")}
              className={`px-3 py-1.5 rounded-t-md font-medium transition-colors ${
                activeTab === "pty"
                  ? "bg-slate-900 text-amber-400 border-t border-x border-slate-800 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              src-tauri/src/pty.rs (portable-pty)
            </button>
            <button
              onClick={() => setActiveTab("main")}
              className={`px-3 py-1.5 rounded-t-md font-medium transition-colors ${
                activeTab === "main"
                  ? "bg-slate-900 text-amber-400 border-t border-x border-slate-800 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              src-tauri/src/main.rs (Tauri IPC)
            </button>
            <button
              onClick={() => setActiveTab("cargo")}
              className={`px-3 py-1.5 rounded-t-md font-medium transition-colors ${
                activeTab === "cargo"
                  ? "bg-slate-900 text-amber-400 border-t border-x border-slate-800 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Cargo.toml
            </button>
            <button
              onClick={() => setActiveTab("conf")}
              className={`px-3 py-1.5 rounded-t-md font-medium transition-colors ${
                activeTab === "conf"
                  ? "bg-slate-900 text-amber-400 border-t border-x border-slate-800 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              tauri.conf.json
            </button>
          </div>
        </div>

        {/* Monaco Editor displaying Rust code */}
        <div className="flex-1 w-full relative">
          <Editor
            height="100%"
            language={getActiveLanguage()}
            theme="vs-dark"
            value={getActiveCode()}
            options={{
              readOnly: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </div>
  );
};
