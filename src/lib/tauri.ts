/**
 * Adaptateur Tauri ↔ Web.
 *
 * L'application cible est une app desktop Tauri (Linux) : le frontend
 * communique avec le backend Rust via `invoke()` et écoute les événements
 * Tauri (`pty-output`). En environnement non-Tauri (tests jsdom, dev web),
 * on retombe sur les appels HTTP/WebSocket hérités pour compatibilité.
 */

// Détection : Tauri injecte __TAURI_INTERNALS__ dans le contexte webview
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Import dynamique pour ne pas charger le module Tauri en environnement web
let tauriCore: typeof import("@tauri-apps/api/core") | null = null;
let tauriEvent: typeof import("@tauri-apps/api/event") | null = null;

async function loadTauri(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    if (!tauriCore) tauriCore = await import("@tauri-apps/api/core");
    if (!tauriEvent) tauriEvent = await import("@tauri-apps/api/event");
    return true;
  } catch (e) {
    console.error("Impossible de charger @tauri-apps/api", e);
    return false;
  }
}

/** Invoke une commande Rust si Tauri, sinon exécute le fallback web. */
export async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  webFallback?: () => Promise<T>
): Promise<T> {
  if (await loadTauri()) {
    return tauriCore!.invoke<T>(cmd, args);
  }
  if (webFallback) return webFallback();
  throw new Error(`Commande Tauri ${cmd} indisponible en mode web`);
}

/** Écoute un événement Tauri (retourne la fonction de désinscription). */
export async function tauriListen<T>(
  event: string,
  handler: (payload: T) => void
): Promise<() => void> {
  if (await loadTauri()) {
    const unlisten = await tauriEvent!.listen<T>(event, (e) => handler(e.payload));
    return unlisten;
  }
  // Mode web : aucun événement natif — le fallback WebSocket s'en charge ailleurs
  return () => {};
}

export interface PtyOutputEvent {
  session_id: string;
  data: string;
}

// ── Helpers métier : mapping formats web ↔ Rust ──────────────────

interface RustPtySessionInfo {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
}

interface RustSystemStats {
  platform: string;
  release: string;
  arch: string;
  hostname: string;
  cpus: number;
  cpu_model: string;
  total_mem: number;
  free_mem: number;
  used_mem: number;
  mem_usage_percent: number;
  uptime: number;
  os_release: string;
  loadavg: number[];
}

/** Liste des sessions PTY (format web) — Tauri uniquement. */
export async function listPtySessionsWeb(): Promise<Array<{ id: string; name: string; shell: string; cwd: string; createdAt: number }>> {
  const sessions = await tauriInvoke<RustPtySessionInfo[]>("list_pty_sessions");
  // L'ordre de la liste Rust reflète l'ordre de création ; createdAt sert
  // uniquement d'horodatage d'affichage côté frontend.
  return sessions.map((s) => ({ id: s.id, name: s.name, shell: s.shell, cwd: s.cwd, createdAt: Date.now() }));
}

/** Crée une session PTY — Tauri uniquement. */
export async function createPtySessionWeb(
  name: string,
  cols = 80,
  rows = 24
): Promise<{ id: string; name: string; shell: string; cwd: string; createdAt: number }> {
  // crypto.getRandomValues : aléa cryptographique (Math.random est insuffisant
  // pour un identifiant — CodeQL js/unsafe-random)
  const rand = new Uint32Array(1);
  crypto.getRandomValues(rand);
  const sessionId = `pty_${Date.now()}_${rand[0].toString(36)}`;
  await tauriInvoke("create_pty_session", {
    sessionId,
    cols,
    rows,
    name,
  });
  return { id: sessionId, name, shell: "", cwd: "", createdAt: Date.now() };
}

/** Ferme une session PTY — Tauri uniquement. */
export async function closePtySessionWeb(id: string): Promise<void> {
  await tauriInvoke("close_pty_session", { sessionId: id });
}

/** Stats système au format web attendu par le frontend. */
export async function getSystemStatsWeb(): Promise<Record<string, unknown>> {
  const s = await tauriInvoke<RustSystemStats>("get_system_stats");
  return {
    platform: s.platform,
    release: s.release,
    arch: s.arch,
    hostname: s.hostname,
    cpus: s.cpus,
    cpuModel: s.cpu_model,
    totalMem: s.total_mem,
    freeMem: s.free_mem,
    usedMem: s.used_mem,
    memUsagePercent: s.mem_usage_percent,
    uptime: s.uptime,
    os_release: s.os_release,
    loadavg: s.loadavg ?? [0, 0, 0],
    cpuCores: [],
    disk: { total: 0, free: 0, used: 0, percent: 0 },
    processes: [],
  };
}
