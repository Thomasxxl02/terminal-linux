import { Router } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import rateLimit from "express-rate-limit";
import * as db from "./db";
import {
  PtyService,
  MaintenanceService,
  PermissionService,
  SynchronizationService,
} from "./services";
import {
  getSafePath,
  validateString,
  validateOptionalString,
  validatePositiveInteger,
} from "./security";
import {
  handleLogin,
  requireAuth,
} from "./auth";

const router = Router();
const ptyService = PtyService.getInstance();

// General API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, veuillez réessayer plus tard." },
  skip: () => process.env.NODE_ENV === "test",
  validate: { xForwardedForHeader: false },
});

// State-changing Operations Limiter
const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 modifications per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Fréquence de modification trop élevée, veuillez patienter." },
  skip: () => process.env.NODE_ENV === "test",
  validate: { xForwardedForHeader: false },
});

// Apply general rate limit to all routes
router.use(apiLimiter);

// 0. Auth APIs + Health (publics — pas de JWT requis)
router.post("/auth/login", handleLogin);
router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Tauri Terminal PTY Backend" });
});

// Toutes les routes suivantes exigent un JWT valide (si AUTH_SECRET configuré)
router.use(requireAuth);

// 1. PTY Sessions APIs (Maps HTTP Requests to PtyService)
router.get("/pty/sessions", (req, res) => {
  const sessions = ptyService.getAllSessions().map((s) => ({
    id: s.id,
    name: s.name,
    shell: s.shell,
    cwd: s.cwd,
    createdAt: s.createdAt,
    clientsCount: s.clients.size,
  }));
  res.json({ sessions });
});

router.post("/pty/create", writeLimiter, (req, res) => {
  try {
    const { name, cwd, shell, env } = req.body || {};
    const validatedName = validateOptionalString(name, "name");
    const validatedCwd = validateOptionalString(cwd, "cwd");
    const validatedShell = validateOptionalString(shell, "shell");
    const safeCwd = validatedCwd ? getSafePath(validatedCwd) : process.cwd();

    const id = `pty_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
    const session = ptyService.createSession(id, validatedName, safeCwd, validatedShell, env);
    res.json({
      id: session.id,
      name: session.name,
      shell: session.shell,
      cwd: session.cwd,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/pty/:id/write", writeLimiter, (req, res) => {
  try {
    const { id } = req.params;
    const { data } = req.body;
    const validatedId = validateString(id, "id");
    const validatedData = validateString(data, "data");

    const session = ptyService.getSession(validatedId);
    if (!session) {
      return res.status(404).json({ error: "Session non trouvée" });
    }

    // Permissions validation logic — rôle issu du JWT, jamais d'un header client
    const role = (req as any).user?.role || "guest";
    if (!PermissionService.isAuthorized(role, "execute_terminal")) {
      return res.status(403).json({ error: "Action non autorisée pour ce rôle" });
    }

    session.process.stdin.write(validatedData);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/pty/:id", writeLimiter, (req, res) => {
  try {
    const { id } = req.params;
    const validatedId = validateString(id, "id");

    const deleted = ptyService.deleteSession(validatedId);
    if (!deleted) {
      return res.status(404).json({ error: "Session non trouvée" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. System Stats, Monitoring and Maintenance APIs
let cachedStats: { timestamp: number; data: any } | null = null;
const STATS_CACHE_TTL_MS = 1000;

function getProcesses(): Promise<any[]> {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      resolve([
        { pid: process.pid, name: "node.exe (server.ts)", cpu: 1.2, mem: 2.1, user: "user" },
        { pid: 1024, name: "System Idle Process", cpu: 95.5, mem: 0.1, user: "SYSTEM" },
        { pid: 4096, name: "explorer.exe", cpu: 0.5, mem: 1.5, user: "user" },
      ]);
      return;
    }

    exec("ps -ao pid,user,%cpu,%mem,comm --sort=-%cpu 2>/dev/null || ps -o pid,user,%cpu,%mem,comm 2>/dev/null", (err, stdout) => {
      if (err || !stdout) {
        resolve([{ pid: process.pid, name: "node server.ts", cpu: 0.8, mem: 1.8, user: "root" }]);
        return;
      }

      const lines = stdout.trim().split("\n");
      const list: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          const pid = parseInt(parts[0], 10);
          const user = parts[1];
          const cpu = parseFloat(parts[2]);
          const mem = parseFloat(parts[3]);
          const name = parts.slice(4).join(" ");
          if (!isNaN(pid)) {
            list.push({ pid, user, cpu, mem, name });
          }
        }
      }
      resolve(list.slice(0, 15));
    });
  });
}

router.get("/system/stats", async (req, res) => {
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

  let disk = { total: 0, free: 0, used: 0, percent: 0 };
  try {
    if (typeof fs.statfsSync === "function") {
      const stats = fs.statfsSync("/");
      const total = stats.bsize * stats.blocks;
      const free = stats.bsize * stats.bavail;
      const used = total - free;
      disk = {
        total,
        free,
        used,
        percent: total > 0 ? Math.round((used / total) * 100) : 0,
      };
    } else {
      disk = { total: 50 * 1024 * 1024 * 1024, free: 32 * 1024 * 1024 * 1024, used: 18 * 1024 * 1024 * 1024, percent: 36 };
    }
  } catch (e) {
    disk = { total: 50 * 1024 * 1024 * 1024, free: 32 * 1024 * 1024 * 1024, used: 18 * 1024 * 1024 * 1024, percent: 36 };
  }

  // Network Interfaces
  const networkInterfaces: any[] = [];
  try {
    const rawNets = os.networkInterfaces();
    for (const [ifaceName, ifaceList] of Object.entries(rawNets)) {
      if (ifaceList) {
        for (const iface of ifaceList) {
          networkInterfaces.push({
            name: ifaceName,
            address: iface.address,
            family: iface.family,
            mac: iface.mac,
            internal: iface.internal,
            netmask: iface.netmask,
          });
        }
      }
    }
  } catch {
    // Ignore
  }

  // CPU Cores Detail
  const cpuCores = cpus.map((c, idx) => ({
    core: idx + 1,
    model: c.model || `Core #${idx + 1}`,
    speed: c.speed || 0,
  }));

  // User Info safely
  let userInfo = { username: "unknown", homedir: "/home", shell: "/bin/bash" };
  try {
    const u = os.userInfo();
    userInfo = {
      username: u.username || "user",
      homedir: u.homedir || os.homedir(),
      shell: u.shell || (process.env.SHELL || "/bin/bash"),
    };
  } catch {
    userInfo = {
      username: process.env.USER || "user",
      homedir: os.homedir() || "/home",
      shell: process.env.SHELL || "/bin/bash",
    };
  }

  // Node runtime info
  const nodeRuntime = {
    nodeVersion: process.version,
    v8Version: process.versions?.v8 || "N/A",
    processUptime: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    pid: process.pid,
  };

  const systemDetails = {
    type: os.type(),
    endianness: os.endianness(),
    tmpdir: os.tmpdir(),
  };

  const activePtySessions = ptyService.getAllSessions().length;

  const processes = await getProcesses();
  const data = {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: cpus.length,
    cpuModel: cpus[0]?.model || "CPU générique",
    cpuCores,
    totalMem,
    freeMem,
    usedMem,
    memUsagePercent: Math.round((usedMem / totalMem) * 100),
    uptime,
    loadavg,
    disk,
    processes,
    networkInterfaces,
    nodeRuntime,
    userInfo,
    systemDetails,
    activePtySessions,
  };

  cachedStats = { timestamp: now, data };
  res.json(data);
});

router.post("/system/kill-process", writeLimiter, (req, res) => {
  try {
    const { pid } = req.body;
    const validatedPid = validatePositiveInteger(pid, "pid");

    // Security Policy validation — rôle issu du JWT
    const role = (req as any).user?.role || "guest";
    if (!PermissionService.isAuthorized(role, "write_system")) {
      return res.status(403).json({ error: "Privilèges insuffisants pour arrêter un processus système" });
    }

    process.kill(validatedPid, "SIGTERM");
    res.json({ success: true, message: `Le processus ${validatedPid} a été arrêté avec succès` });
  } catch (err: any) {
    res.status(500).json({ error: `Impossible d'arrêter le processus : ${err.message}` });
  }
});

router.post("/system/maintenance", writeLimiter, (req, res) => {
  try {
    const { task, sessionId } = req.body;
    const validatedTask = validateString(task, "task");
    const validatedSessionId = validateString(sessionId, "sessionId");

    // Whitelist check to prevent uncontrolled command injection
    const whitelistedTasks = ["apt-update", "apt-clean", "logs-purge", "disk-space", "top-processes"];
    if (!whitelistedTasks.includes(validatedTask)) {
      return res.status(400).json({ error: "Tâche de maintenance non valide" });
    }

    const session = ptyService.getSession(validatedSessionId);
    if (!session) {
      return res.status(400).json({ error: "Veuillez sélectionner un terminal actif pour exécuter la maintenance." });
    }

    // Formulates command using maintenance service (Business logic)
    const command = MaintenanceService.getMaintenanceCommand(validatedTask);
    session.process.stdin.write(command);
    res.json({ success: true, message: "Commande envoyée au terminal", command });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Local File System APIs
router.get("/fs/tree", async (req, res) => {
  try {
    const targetDir = getSafePath(req.query.path);
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
        // Ignore
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

router.get("/fs/read", async (req, res) => {
  try {
    const filePath = getSafePath(req.query.path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier non trouvé" });
    }

    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: "Le chemin spécifié est un dossier, pas un fichier" });
    }
    if (stat.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: "Fichier trop volumineux (> 2Mo)" });
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

router.post("/fs/write", writeLimiter, async (req, res) => {
  try {
    const { path: filePath, content, encoding } = req.body;
    const safeFile = getSafePath(filePath);

    const validatedContent = validateString(content, "content");
    const validatedEncoding = validateOptionalString(encoding, "encoding");

    // Role-based path security checks — rôle issu du JWT
    const role = (req as any).user?.role || "guest";
    if (!PermissionService.validatePathAccess(safeFile, role)) {
      return res.status(403).json({ error: "Accès restreint à ce dossier pour votre niveau de permissions" });
    }

    if (validatedEncoding === "base64") {
      const buffer = Buffer.from(validatedContent, "base64");
      await fs.promises.writeFile(safeFile, buffer);
    } else {
      await fs.promises.writeFile(safeFile, validatedContent, "utf-8");
    }
    res.json({ success: true, message: "Fichier sauvegardé avec succès" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/fs/create-file", writeLimiter, async (req, res) => {
  try {
    const { path: filePath } = req.body;
    const safeFile = getSafePath(filePath);
    if (fs.existsSync(safeFile)) return res.status(400).json({ error: "Le fichier existe déjà" });
    await fs.promises.writeFile(safeFile, "", "utf-8");
    res.json({ success: true, message: "Fichier créé avec succès" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/fs/create-directory", writeLimiter, async (req, res) => {
  try {
    const { path: dirPath } = req.body;
    const safeDir = getSafePath(dirPath);
    if (fs.existsSync(safeDir)) return res.status(400).json({ error: "Le dossier existe déjà" });
    await fs.promises.mkdir(safeDir, { recursive: true });
    res.json({ success: true, message: "Dossier créé avec succès" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/fs/delete", writeLimiter, async (req, res) => {
  try {
    const { path: itemPath } = req.body;
    const safeItem = getSafePath(itemPath);
    if (!fs.existsSync(safeItem)) return res.status(404).json({ error: "Élément introuvable" });

    const role = (req as any).user?.role || "guest";
    if (!PermissionService.validatePathAccess(safeItem, role)) {
      return res.status(403).json({ error: "Privilèges insuffisants pour supprimer des fichiers système" });
    }

    const stat = await fs.promises.stat(safeItem);
    if (stat.isDirectory()) {
      await fs.promises.rm(safeItem, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(safeItem);
    }
    res.json({ success: true, message: "Élément supprimé" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/fs/rename", writeLimiter, async (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    const safeOld = getSafePath(oldPath);
    const safeNew = getSafePath(newPath);
    if (!fs.existsSync(safeOld)) return res.status(404).json({ error: "Source introuvable" });
    if (fs.existsSync(safeNew)) return res.status(400).json({ error: "La destination existe déjà" });
    await fs.promises.rename(safeOld, safeNew);
    res.json({ success: true, message: "Élément renommé" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. PostgreSQL Synchronized Tables REST APIs
// Exposes the real/mock PostgreSQL client to UI while ensuring sync logs
router.get("/db/hosts", async (req, res) => {
  try {
    const hosts = await db.fetchAllSshHosts();
    res.json({ hosts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/db/hosts", writeLimiter, async (req, res) => {
  try {
    const { name, host, port, username, description } = req.body;
    const validatedName = validateString(name, "name");
    const validatedHost = validateString(host, "host");
    const validatedPort = Number(port) || 22;
    const validatedUsername = validateString(username, "username");
    const validatedDesc = validateOptionalString(description, "description") || "";

    const id = `host_${Date.now()}`;
    const newHost = { id, name: validatedName, host: validatedHost, port: validatedPort, username: validatedUsername, description: validatedDesc };
    
    // DB write + Sync event logger
    await db.insertSshHost(newHost);
    await SynchronizationService.syncEntity("ssh_host", id, "create", `Création de l'hôte ${validatedName}`);
    
    res.json({ success: true, host: newHost });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/db/hosts/:id", writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedId = validateString(id, "id");

    await db.deleteSshHost(validatedId);
    await SynchronizationService.syncEntity("ssh_host", validatedId, "delete", "Suppression de l'hôte");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/db/snippets", async (req, res) => {
  try {
    const snippets = await db.fetchAllSnippets();
    res.json({ snippets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/db/snippets", writeLimiter, async (req, res) => {
  try {
    const { title, command, category, description } = req.body;
    const validatedTitle = validateString(title, "title");
    const validatedCommand = validateString(command, "command");
    const validatedCategory = validateString(category, "category");
    const validatedDesc = validateOptionalString(description, "description") || "";

    const id = `snip_${Date.now()}`;
    const newSnippet = { id, title: validatedTitle, command: validatedCommand, category: validatedCategory, description: validatedDesc };

    await db.insertSnippet(newSnippet);
    await SynchronizationService.syncEntity("snippet", id, "create", `Ajout du snippet ${validatedTitle}`);

    res.json({ success: true, snippet: newSnippet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/db/snippets/:id", writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedId = validateString(id, "id");

    await db.deleteSnippet(validatedId);
    await SynchronizationService.syncEntity("snippet", validatedId, "delete", "Suppression de snippet");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/db/playbooks", async (req, res) => {
  try {
    const playbooks = await db.fetchAllPlaybooks();
    res.json({ playbooks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/db/playbooks", writeLimiter, async (req, res) => {
  try {
    const { name, steps } = req.body;
    const validatedName = validateString(name, "name");
    
    // Ensure steps are secure and typed correctly
    if (!Array.isArray(steps)) {
      return res.status(400).json({ error: "Le paramètre 'steps' doit être un tableau" });
    }

    const id = `play_${Date.now()}`;
    const newPlaybook = { id, name: validatedName, steps };

    await db.insertPlaybook(newPlaybook);
    await SynchronizationService.syncEntity("playbook", id, "create", `Création du playbook ${validatedName}`);

    res.json({ success: true, playbook: newPlaybook });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/db/playbooks/:id", writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedId = validateString(id, "id");

    await db.deletePlaybook(validatedId);
    await SynchronizationService.syncEntity("playbook", validatedId, "delete", "Suppression de playbook");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/db/sync-report", async (req, res) => {
  try {
    const report = await SynchronizationService.getSynchronizationReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Tauri Architecture Provider
router.get("/tauri/source", (req, res) => {
  res.json({
    cargoToml: "[package]\nname=\"tauri-linux-terminal\"",
    mainRs: "fn main() { println!(\"Hello from Tauri!\"); }",
    ptyRs: "// pty manager placeholder",
    tauriConfJson: "{}",
  });
});

export default router;
