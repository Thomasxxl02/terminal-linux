import { spawn, exec, ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { WebSocket } from "ws";
import * as db from "./db";

// Liste blanche de shells autorisés : un chemin fourni par l'utilisateur
// ne doit jamais être spawné tel quel (command injection / exécution arbitraire).
const ALLOWED_SHELLS: readonly string[] = [
  "/bin/bash",
  "/usr/bin/bash",
  "/bin/zsh",
  "/usr/bin/zsh",
  "/bin/sh",
  "/usr/bin/sh",
  "/bin/dash",
  "/usr/bin/dash",
  "/bin/ksh",
  "/usr/bin/ksh",
  "/usr/bin/fish",
  "/usr/bin/pwsh",
  "cmd.exe",
  "powershell.exe",
];

function isAllowedShell(shellPath: string): boolean {
  return ALLOWED_SHELLS.includes(shellPath) && fs.existsSync(shellPath);
}

// PTY Session definition for PtyService
export interface PtySession {
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

// 1. PTY Sessions Management Service
export class PtyService {
  private ptySessions = new Map<string, PtySession>();
  private static instance: PtyService | null = null;

  public static getInstance(): PtyService {
    if (!this.instance) {
      this.instance = new PtyService();
    }
    return this.instance;
  }

  public getSession(id: string): PtySession | undefined {
    return this.ptySessions.get(id);
  }

  public getAllSessions(): PtySession[] {
    return Array.from(this.ptySessions.values());
  }

  public createSession(
    id: string,
    name?: string,
    initialCwd?: string,
    requestedShell?: string,
    customEnv?: Record<string, string>
  ): PtySession {
    const defaultShell = process.env.SHELL || (os.platform() === "win32" ? "cmd.exe" : "/bin/bash");
    const fallbackShell = os.platform() === "win32" ? "powershell.exe" : "/bin/sh";
    
    let shellToUse = requestedShell || defaultShell;
    // Sécurité : seul un shell de la liste blanche (et existant) est accepté.
    // Un chemin arbitraire fourni par l'utilisateur est ignoré (fallback).
    if (!isAllowedShell(shellToUse)) {
      shellToUse = isAllowedShell(defaultShell) ? defaultShell : fallbackShell;
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
        if (client.readyState === 1) { // OPEN
          client.send(payload);
        }
      }
    };

    const stringDecoder = new TextDecoder("utf-8");

    const handleOutput = (data: Buffer) => {
      const str = stringDecoder.decode(data, { stream: true });
      session.pendingOutput += str;

      if (session.pendingOutput.length >= 32768) {
        if (session.flushTimer) {
          clearTimeout(session.flushTimer);
        }
        flushOutputBuffer();
      } else if (!session.flushTimer) {
        session.flushTimer = setTimeout(flushOutputBuffer, 16);
      }
    };

    proc.stdout.on("data", handleOutput);
    proc.stderr.on("data", handleOutput);

    proc.on("exit", (code) => {
      const exitMsg = `\r\n\x1b[33m[Processus terminé avec le code ${code}]\x1b[0m\r\n`;
      const payload = JSON.stringify({ type: "exit", code });
      for (const client of session.clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "output", data: exitMsg }));
          client.send(payload);
        }
      }
    });

    proc.on("error", (err) => {
      const errMsg = `\r\n\x1b[31m[Erreur de lancement du shell: ${err.message}]\x1b[0m\r\n`;
      for (const client of session.clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "output", data: errMsg }));
        }
      }
    });

    this.ptySessions.set(id, session);
    return session;
  }

  public deleteSession(id: string): boolean {
    const session = this.ptySessions.get(id);
    if (session) {
      try {
        session.process.kill("SIGKILL");
      } catch {
        // Ignore kill errors
      }
      this.ptySessions.delete(id);
      return true;
    }
    return false;
  }

  public cleanupDeadSessions() {
    for (const [id, session] of this.ptySessions.entries()) {
      if (session.process.killed || session.process.exitCode !== null) {
        for (const client of session.clients) {
          if (client.readyState === 1) {
            client.close(1000, "PTY session terminated");
          }
        }
        this.ptySessions.delete(id);
      }
    }
  }

  public shutdownAll() {
    for (const [id, session] of this.ptySessions.entries()) {
      try {
        session.process.kill("SIGTERM");
      } catch {
        // Ignore kill errors
      }
      this.ptySessions.delete(id);
    }
  }
}

// 2. Terminal Maintenance Management Service
export class MaintenanceService {
  public static getMaintenanceCommand(task: string): string {
    switch (task) {
      case "apt-update":
        return "echo '[MAINTENANCE] Mise à jour des paquets...' && apt-get update || echo '[Note] Mode utilisateur sans privilèges apt'\n";
      case "apt-clean":
        return "echo '[MAINTENANCE] Nettoyage du cache...' && apt-get clean || rm -rf /tmp/* ~/.cache/* 2>/dev/null && echo '[OK] Cache utilisateur nettoyé'\n";
      case "logs-purge":
        return "echo '[MAINTENANCE] Purge des fichiers journaux obsolètes...' && du -sh /var/log 2>/dev/null; find /var/log -type f -name '*.log' -size +10M -delete 2>/dev/null; echo '[OK] Logs purgés'\n";
      case "disk-space":
        return "df -h && echo '--- Occupation des sous-dossiers ---' && du -sh ./* 2>/dev/null | sort -hr | head -n 10\n";
      case "top-processes":
        return "ps aux --sort=-%cpu | head -n 12\n";
      default:
        return "echo '[MAINTENANCE] Tâche non autorisée ou non reconnue'\n";
    }
  }
}

// 3. Permission Engine / RBAC Policy Checks (Permissions Logic)
export class PermissionService {
  private static userRoles: Record<string, string[]> = {
    admin: ["read_system", "write_system", "execute_terminal", "write_db", "sync_data"],
    developer: ["read_system", "execute_terminal", "write_db"],
    guest: ["read_system"]
  };

  public static isAuthorized(role: string, action: string): boolean {
    const permissions = this.userRoles[role] || this.userRoles["guest"];
    return permissions.includes(action);
  }

  public static validatePathAccess(targetPath: string, role: string): boolean {
    if (role === "admin") return true;
    
    // Developer or guest shouldn't manipulate root critical directories
    const normalized = path.normalize(targetPath);
    const restrictedPaths = ["/etc/shadow", "/etc/passwd", "/boot", "/root"];
    for (const restricted of restrictedPaths) {
      if (normalized.startsWith(restricted)) {
        return false;
      }
    }
    return true;
  }
}

// 4. Synchronization Logic & State Reconciliation (Sync Logic)
export class SynchronizationService {
  public static async syncEntity(
    entityType: "ssh_host" | "snippet" | "playbook",
    entityId: string,
    action: "create" | "update" | "delete",
    details?: string
  ): Promise<void> {
    // 1. Audit logs persisted into PostgreSQL
    await db.insertSyncLog({
      entity_type: entityType,
      entity_id: entityId,
      action,
      details: details || `Reconciled ${action} on ${entityType} ID: ${entityId}`
    });
    console.log(`[SYNC RECONCILIATION] Successfully recorded sync: ${action} on ${entityType}`);
  }

  public static async getSynchronizationReport() {
    const logs = await db.fetchSyncLogs();
    return {
      status: "synchronized",
      lastSync: logs.length > 0 ? logs[0].performed_at : new Date(),
      totalRecordsSynced: logs.length,
      logs
    };
  }
}
