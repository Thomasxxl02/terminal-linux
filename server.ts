import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface PtySession {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  process: ChildProcessWithoutNullStreams;
  clients: Set<WebSocket>;
  cols: number;
  rows: number;
  createdAt: number;
  buffer: string[];
  pendingOutput: string;
  flushTimer: NodeJS.Timeout | null;
}

export const app = express();
const PORT = 3000;
export const server = http.createServer(app);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Tauri Terminal PTY Backend" });
});

// In-memory active PTY sessions
const ptySessions = new Map<string, PtySession>();

// Initialize WebSocket server for PTY stream
const wss = new WebSocketServer({ noServer: true });
const HEARTBEAT_INTERVAL = 30000;

const pingInterval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    if ((ws as any).isAlive === false) {
      return ws.terminate();
    }
    (ws as any).isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://${request.headers.host}`);
  if (url.pathname.startsWith("/ws/pty")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket, request: http.IncomingMessage) => {
  (ws as any).isAlive = true;
  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });

  const url = new URL(request.url || "", `http://${request.headers.host}`);
  const sessionId = url.searchParams.get("id");

  if (!sessionId || !ptySessions.has(sessionId)) {
    ws.send(JSON.stringify({ type: "error", message: "Session non trouvée" }));
    ws.close();
    return;
  }

  const session = ptySessions.get(sessionId)!;
  session.clients.add(ws);

  // Send initial connected acknowledgement and cached recent output buffer
  ws.send(JSON.stringify({ 
    type: "connected", 
    sessionId: session.id,
    cols: session.cols,
    rows: session.rows,
    cwd: session.cwd,
  }));

  if (session.buffer.length > 0) {
    ws.send(JSON.stringify({
      type: "output",
      data: session.buffer.join(""),
    }));
  }

  ws.on("message", (message: string | Buffer) => {
    try {
      const msg = JSON.parse(message.toString());
      if (msg.type === "input" && typeof msg.data === "string") {
        session.process.stdin.write(msg.data);
      } else if (msg.type === "resize" && msg.cols && msg.rows) {
        session.cols = msg.cols;
        session.rows = msg.rows;
        // Broadcast size change or send SIGWINCH if supported
        try {
          // Send resize signal or env update if needed
          if (process.platform !== "win32") {
            session.process.kill("SIGWINCH");
          }
        } catch {
          // Ignore signal errors
        }
      } else if (msg.type === "kill") {
        session.process.kill("SIGTERM");
      }
    } catch (e) {
      console.error("Failed to parse WS message:", e);
    }
  });

  ws.on("close", () => {
    session.clients.delete(ws);
  });
});

// Helper function to create a live PTY child process session
function createSession(
  id: string,
  name?: string,
  initialCwd?: string,
  requestedShell?: string,
  customEnv?: Record<string, string>
): PtySession {
  const defaultShell = process.env.SHELL || (os.platform() === "win32" ? "cmd.exe" : "/bin/bash");
  const fallbackShell = os.platform() === "win32" ? "powershell.exe" : "/bin/sh";
  
  let shellToUse = requestedShell || defaultShell;
  if (!fs.existsSync(shellToUse)) {
    if (fs.existsSync(defaultShell)) {
      shellToUse = defaultShell;
    } else {
      shellToUse = fallbackShell;
    }
  }

  const cwd = initialCwd && fs.existsSync(initialCwd) ? initialCwd : process.cwd();

  const env = {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    LANG: "fr_FR.UTF-8",
    PS1: "\\[\\e[32m\\]\\u@linux-emulator\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]\\$ ",
    ...(customEnv || {}),
  };

  // Spawn child process with interactive flag
  const args = shellToUse.includes("bash") || shellToUse.includes("zsh") ? ["-i"] : [];
  const proc = spawn(shellToUse, args, {
    cwd,
    env,
    shell: false,
  });

  const session: PtySession = {
    id,
    name: name || `Terminal #${id.slice(0, 4)}`,
    shell: shellToUse,
    cwd,
    process: proc,
    clients: new Set(),
    cols: 80,
    rows: 24,
    createdAt: Date.now(),
    buffer: [],
    pendingOutput: "",
    flushTimer: null,
  };

  const flushOutputBuffer = () => {
    if (!session.pendingOutput) return;
    const chunk = session.pendingOutput;
    session.pendingOutput = "";
    session.flushTimer = null;

    session.buffer.push(chunk);
    if (session.buffer.length > 500) {
      session.buffer.shift();
    }

    const payload = JSON.stringify({ type: "output", data: chunk });
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

const stringDecoder = new TextDecoder("utf-8");

  const handleOutput = (data: Buffer) => {
    const str = stringDecoder.decode(data, { stream: true });
    session.pendingOutput += str;

    // Flush immediately if buffer is large (>= 32KB)
    if (session.pendingOutput.length >= 32768) {
      if (session.flushTimer) {
        clearTimeout(session.flushTimer);
      }
      flushOutputBuffer();
    } else if (!session.flushTimer) {
      // Otherwise schedule flush at ~60 FPS (16ms)
      session.flushTimer = setTimeout(flushOutputBuffer, 16);
    }
  };

  proc.stdout.on("data", handleOutput);
  proc.stderr.on("data", handleOutput);

  proc.on("exit", (code) => {
    const exitMsg = `\r\n\x1b[33m[Processus terminé avec le code ${code}]\x1b[0m\r\n`;
    const payload = JSON.stringify({ type: "exit", code });
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "output", data: exitMsg }));
        client.send(payload);
      }
    }
  });

  proc.on("error", (err) => {
    const errMsg = `\r\n\x1b[31m[Erreur de lancement du shell: ${err.message}]\x1b[0m\r\n`;
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "output", data: errMsg }));
      }
    }
  });

  ptySessions.set(id, session);
  return session;
}

// REST API Endpoints for Session Management
app.get("/api/pty/sessions", (req, res) => {
  const list = Array.from(ptySessions.values()).map((s) => ({
    id: s.id,
    name: s.name,
    shell: s.shell,
    cwd: s.cwd,
    createdAt: s.createdAt,
    clientsCount: s.clients.size,
  }));
  res.json({ sessions: list });
});

app.post("/api/pty/create", (req, res) => {
  const id = `pty_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const { name, cwd, shell, env } = req.body || {};
  const session = createSession(id, name, cwd, shell, env);
  res.json({
    id: session.id,
    name: session.name,
    shell: session.shell,
    cwd: session.cwd,
  });
});

app.post("/api/pty/:id/write", (req, res) => {
  const { id } = req.params;
  const { data } = req.body;
  const session = ptySessions.get(id);

  if (!session) {
    return res.status(404).json({ error: "Session non trouvée" });
  }

  if (data && typeof data === "string") {
    session.process.stdin.write(data);
  }

  res.json({ success: true });
});

app.delete("/api/pty/:id", (req, res) => {
  const { id } = req.params;
  const session = ptySessions.get(id);

  if (session) {
    try {
      session.process.kill("SIGKILL");
    } catch {
      // Ignore process kill errors
    }
    ptySessions.delete(id);
  }

  res.json({ success: true });
});

// Periodic Garbage Collector for dead PTY processes
const sessionGarbageCollector = setInterval(() => {
  for (const [id, session] of ptySessions.entries()) {
    if (session.process.killed || session.process.exitCode !== null) {
      for (const client of session.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1000, "PTY session terminated");
        }
      }
      ptySessions.delete(id);
    }
  }
}, 30000);

// Graceful Process Shutdown Handler
const handleGracefulShutdown = (signal: string) => {
  console.log(`\n[SERVER] Shutdown signal (${signal}) received. Cleaning up active PTY child processes...`);
  clearInterval(sessionGarbageCollector);
  clearInterval(pingInterval);

  for (const [id, session] of ptySessions.entries()) {
    try {
      session.process.kill("SIGTERM");
    } catch {
      // Ignore kill errors
    }
    ptySessions.delete(id);
  }

  server.close(() => {
    console.log("[SERVER] HTTP and WebSocket servers closed. Exiting process.");
    process.exit(0);
  });
};

process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));

// System Stats Endpoint with 1000ms TTL Cache
let cachedStats: { timestamp: number; data: any } | null = null;
const STATS_CACHE_TTL_MS = 1000;

app.get("/api/system/stats", (req, res) => {
  const now = Date.now();
  if (cachedStats && now - cachedStats.timestamp < STATS_CACHE_TTL_MS) {
    return res.json(cachedStats.data);
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();
  const uptime = os.uptime();
  const loadavg = os.loadavg();

  const data = {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: cpus.length,
    cpuModel: cpus[0]?.model || "CPU générique",
    totalMem,
    freeMem,
    usedMem,
    memUsagePercent: Math.round((usedMem / totalMem) * 100),
    uptime,
    loadavg,
  };

  cachedStats = { timestamp: now, data };
  res.json(data);
});

// Maintenance Shortcuts Endpoint
app.post("/api/system/maintenance", (req, res) => {
  const { task, sessionId } = req.body;
  const session = sessionId ? ptySessions.get(sessionId) : null;

  let command = "";
  switch (task) {
    case "apt-update":
      command = "echo '[MAINTENANCE] Mise à jour des paquets...' && apt-get update || echo '[Note] Mode utilisateur sans privilèges apt'\n";
      break;
    case "apt-clean":
      command = "echo '[MAINTENANCE] Nettoyage du cache...' && apt-get clean || rm -rf /tmp/* ~/.cache/* 2>/dev/null && echo '[OK] Cache utilisateur nettoyé'\n";
      break;
    case "logs-purge":
      command = "echo '[MAINTENANCE] Purge des fichiers journaux obsolètes...' && du -sh /var/log 2>/dev/null; find /var/log -type f -name '*.log' -size +10M -delete 2>/dev/null; echo '[OK] Logs purgés'\n";
      break;
    case "disk-space":
      command = "df -h && echo '--- Occupation des sous-dossiers ---' && du -sh ./* 2>/dev/null | sort -hr | head -n 10\n";
      break;
    case "top-processes":
      command = "ps aux --sort=-%cpu | head -n 12\n";
      break;
    default:
      command = `echo '[MAINTENANCE] Exécution de la commande : ${task}'\n`;
  }

  if (session) {
    session.process.stdin.write(command);
    return res.json({ success: true, message: "Commande envoyée au terminal", command });
  }

  res.status(400).json({ error: "Veuillez sélectionner un terminal actif pour exécuter la maintenance." });
});

// File System APIs for Monaco Editor & File Browser
app.get("/api/fs/tree", async (req, res) => {
  try {
    const targetDir = (req.query.path as string) || process.cwd();
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: "Dossier introuvable" });
    }

    const items = await fs.promises.readdir(targetDir, { withFileTypes: true });
    const sorted = items.sort((a, b) => (b.isDirectory() ? 1 : 0) - (a.isDirectory() ? 1 : 0) || a.name.localeCompare(b.name));
    const totalCount = sorted.length;
    const MAX_ITEMS = 300;
    const truncated = totalCount > MAX_ITEMS;
    const sliced = sorted.slice(0, MAX_ITEMS);

    const result = sliced.map((item) => {
      const itemPath = path.join(targetDir, item.name);
      let size = 0;
      try {
        if (!item.isDirectory()) {
          size = fs.statSync(itemPath).size;
        }
      } catch {
        // Ignore permission or dead symlink errors
      }

      return {
        name: item.name,
        path: itemPath,
        isDirectory: item.isDirectory(),
        size,
      };
    });

    res.json({
      currentPath: targetDir,
      parentPath: path.dirname(targetDir),
      items: result,
      totalCount,
      truncated,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/fs/read", async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier non trouvé" });
    }

    const stat = await fs.promises.stat(filePath);
    if (stat.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: "Fichier trop volumineux (> 2Mo) pour l'affichage Monaco" });
    }

    const content = await fs.promises.readFile(filePath, "utf-8");
    res.json({
      path: filePath,
      name: path.basename(filePath),
      content,
      extension: path.extname(filePath).slice(1),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/fs/write", async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: "Chemin de fichier requis" });
    }

    await fs.promises.writeFile(filePath, content, "utf-8");
    res.json({ success: true, message: "Fichier sauvegardé avec succès" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tauri + Rust Architecture Code Export Provider
app.get("/api/tauri/source", (req, res) => {
  const cargoPath = path.join(process.cwd(), "src-tauri", "Cargo.toml");
  const mainRsPath = path.join(process.cwd(), "src-tauri", "src", "main.rs");
  const ptyRsPath = path.join(process.cwd(), "src-tauri", "src", "pty.rs");
  const tauriConfPath = path.join(process.cwd(), "src-tauri", "tauri.conf.json");

  let cargoToml = "";
  let mainRs = "";
  let ptyRs = "";
  let tauriConfJson = "";

  try {
    if (fs.existsSync(cargoPath)) {
      cargoToml = fs.readFileSync(cargoPath, "utf-8");
    }
    if (fs.existsSync(mainRsPath)) {
      mainRs = fs.readFileSync(mainRsPath, "utf-8");
    }
    if (fs.existsSync(ptyRsPath)) {
      ptyRs = fs.readFileSync(ptyRsPath, "utf-8");
    }
    if (fs.existsSync(tauriConfPath)) {
      tauriConfJson = fs.readFileSync(tauriConfPath, "utf-8");
    }
  } catch (err) {
    console.error("Failed to read actual Tauri source files from disk:", err);
  }

  res.json({
    cargoToml: cargoToml || `[package]
name = "tauri-linux-terminal"
version = "0.1.0"
description = "Linux Terminal Emulator powered by Tauri, Rust & portable-pty"
authors = ["AI Studio Developer"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.5", features = ["shell-open", "window-start-dragging", "process-command-api"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.35", features = ["full"] }
portable-pty = "0.8"
anyhow = "1.0"
log = "0.4"
env_logger = "0.10"
`,
    mainRs: mainRs || `// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod pty;

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tauri::{State, Window, Manager};
use pty::PtyManager;

pub struct AppState {
    pub pty_manager: Arc<Mutex<PtyManager>>,
}

#[tauri::command]
async fn create_terminal(
    state: State<'_, AppState>,
    window: Window,
    rows: u16,
    cols: u16,
) -> Result<String, String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.create_session(window, rows, cols).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_terminal(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.write_to_session(&session_id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
async fn resize_terminal(
    state: State<'_, AppState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let mut manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.resize_session(&session_id, rows, cols).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            pty_manager: Arc::new(Mutex::new(PtyManager::new())),
        })
        .invoke_handler(tauri::generate_handler![
            create_terminal,
            write_terminal,
            resize_terminal
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement de l'application Tauri");
}
`,
    ptyRs: ptyRs || `// src-tauri/src/pty.rs
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Window;

pub struct PtySession {
    pub pair: PtyPair,
    pub writer: Box<dyn Write + Send>,
}

pub struct PtyManager {
    sessions: HashMap<String, PtySession>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn create_session(
        &mut self,
        window: Window,
        rows: u16,
        cols: u16,
    ) -> anyhow::Result<String> {
        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let cmd = CommandBuilder::new(&shell);

        let _child = pair.slave.spawn_command(cmd)?;
        let writer = pair.master.take_writer()?;
        let mut reader = pair.master.try_clone_reader()?;

        let session_id = format!("pty_{}", uuid::Uuid::new_v4().to_string());
        let window_clone = window.clone();
        let event_id = format!("pty-data-{}", session_id);

        // Spawn async reader thread bridging PTY stdout to Tauri window event
        thread::spawn(move || {
            let mut buf = [0u8; 1024];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = window_clone.emit(&event_id, data);
                    }
                    Err(_) => break,
                }
            }
        });

        self.sessions.insert(
            session_id.clone(),
            PtySession { pair, writer },
        );

        Ok(session_id)
    }

    pub fn write_to_session(&mut self, session_id: &str, data: &str) -> anyhow::Result<()> {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session.writer.write_all(data.as_bytes())?;
            session.writer.flush()?;
        }
        Ok(())
    }

    pub fn resize_session(&mut self, session_id: &str, rows: u16, cols: u16) -> anyhow::Result<()> {
        if let Some(session) = self.sessions.get_mut(session_id) {
            session.pair.master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })?;
        }
        Ok(())
    }
}
`,
    tauriConfJson: tauriConfJson || `{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Linux Terminal Emulator",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": true,
        "execute": true,
        "open": true
      }
    },
    "windows": [
      {
        "title": "Linux Terminal Emulator (Tauri + Rust)",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false,
        "decorations": true
      }
    ],
    "security": {
      "csp": null
    }
  }
}`
  });
});

async function startServer() {
  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Create an initial session
  createSession("pty_default", "Terminal Principal - Bash", process.cwd());

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Linux Terminal Emulator Server running at http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  startServer();
}
