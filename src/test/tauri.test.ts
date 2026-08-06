import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks : @tauri-apps/api (imports dynamiques dans tauri.ts) ──
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));

import {
  isTauri,
  tauriInvoke,
  tauriListen,
  listPtySessionsWeb,
  createPtySessionWeb,
  closePtySessionWeb,
  getSystemStatsWeb,
  listProcessesWeb,
  killProcessWeb,
} from "../lib/tauri";

/** Simule la présence/absence de l'environnement Tauri dans la webview. */
function setTauri(active: boolean) {
  if (active) {
    (window as unknown as Record<string, unknown>)["__TAURI_INTERNALS__"] = {};
  } else {
    delete (window as unknown as Record<string, unknown>)["__TAURI_INTERNALS__"];
  }
}

describe("isTauri — détection d'environnement", () => {
  afterEach(() => setTauri(false));

  it("retourne true si __TAURI_INTERNALS__ est présent", () => {
    setTauri(true);
    expect(isTauri()).toBe(true);
  });

  it("retourne false en environnement web/jsdom", () => {
    setTauri(false);
    expect(isTauri()).toBe(false);
  });
});

describe("tauriInvoke", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.listen.mockReset();
    setTauri(false);
  });

  it("exécute le fallback web si Tauri absent et fallback fourni", async () => {
    const fallback = vi.fn().mockResolvedValue("fallback-data");
    await expect(tauriInvoke("get_x", undefined, fallback)).resolves.toBe("fallback-data");
    expect(fallback).toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("lance une erreur claire si Tauri absent et aucun fallback", async () => {
    await expect(tauriInvoke("get_x")).rejects.toThrow("indisponible en mode web");
  });

  it("appelle invoke() en mode Tauri avec la commande et les arguments", async () => {
    setTauri(true);
    mocks.invoke.mockResolvedValue("native");
    await expect(tauriInvoke("get_x", { a: 1 })).resolves.toBe("native");
    expect(mocks.invoke).toHaveBeenCalledWith("get_x", { a: 1 });
  });
});

describe("tauriListen", () => {
  beforeEach(() => {
    mocks.listen.mockReset();
    setTauri(false);
  });

  it("retourne une désinscription no-op en mode web", async () => {
    const unlisten = await tauriListen("pty-output", () => {});
    expect(typeof unlisten).toBe("function");
    expect(mocks.listen).not.toHaveBeenCalled();
  });

  it("écoute et désabonne via listen() en mode Tauri", async () => {
    setTauri(true);
    const unlistenMock = vi.fn();
    mocks.listen.mockImplementation(async (_evt: string, cb: (e: { payload: unknown }) => void) => {
      cb({ payload: "données" });
      return unlistenMock;
    });
    const handler = vi.fn();
    const unlisten = await tauriListen("pty-output", handler);
    expect(handler).toHaveBeenCalledWith("données");
    unlisten();
    expect(unlistenMock).toHaveBeenCalled();
  });
});

describe("helpers métier Tauri (mapping formats)", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    setTauri(true);
  });

  it("listPtySessionsWeb mappe id/name/shell/cwd + createdAt", async () => {
    mocks.invoke.mockResolvedValue([
      { id: "pty_1", name: "Bash", shell: "/bin/bash", cwd: "/home", cols: 80, rows: 24 },
    ]);
    const sessions = await listPtySessionsWeb();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ id: "pty_1", name: "Bash", shell: "/bin/bash", cwd: "/home" });
    expect(typeof sessions[0].createdAt).toBe("number");
  });

  it("createPtySessionWeb génère un id unique cryptographique et appelle create_pty_session", async () => {
    mocks.invoke.mockResolvedValue(undefined);
    const session = await createPtySessionWeb("Mon shell", 120, 40);
    expect(session.id).toMatch(/^pty_/);
    expect(session.name).toBe("Mon shell");
    expect(mocks.invoke).toHaveBeenCalledWith("create_pty_session", {
      sessionId: session.id,
      cols: 120,
      rows: 40,
      name: "Mon shell",
    });
  });

  it("closePtySessionWeb appelle close_pty_session", async () => {
    mocks.invoke.mockResolvedValue(undefined);
    await closePtySessionWeb("pty_1");
    expect(mocks.invoke).toHaveBeenCalledWith("close_pty_session", { sessionId: "pty_1" });
  });

  it("getSystemStatsWeb convertit le format snake_case Rust en camelCase web", async () => {
    mocks.invoke.mockResolvedValue({
      platform: "linux",
      release: "6.8",
      arch: "x86_64",
      hostname: "vps",
      cpus: 2,
      cpu_model: "Intel",
      total_mem: 8000000000,
      free_mem: 4000000000,
      used_mem: 4000000000,
      mem_usage_percent: 50,
      uptime: 3600,
      os_release: "Ubuntu 24.04",
      loadavg: [0.5, 0.3, 0.1],
    });
    const stats = await getSystemStatsWeb();
    expect(stats.cpuModel).toBe("Intel");
    expect(stats.totalMem).toBe(8000000000);
    expect(stats.memUsagePercent).toBe(50);
    expect(stats.loadavg).toEqual([0.5, 0.3, 0.1]);
    expect(stats.disk).toEqual({ total: 0, free: 0, used: 0, percent: 0 });
  });

  it("getSystemStatsWeb fournit un loadavg par défaut si absent", async () => {
    mocks.invoke.mockResolvedValue({
      platform: "linux",
      release: "6.8",
      arch: "x86_64",
      hostname: "vps",
      cpus: 2,
      cpu_model: "Intel",
      total_mem: 1,
      free_mem: 0,
      used_mem: 1,
      mem_usage_percent: 99,
      uptime: 1,
      os_release: "x",
    });
    const stats = await getSystemStatsWeb();
    expect(stats.loadavg).toEqual([0, 0, 0]);
  });

  it("listProcessesWeb et killProcessWeb délèguent aux commandes Rust", async () => {
    mocks.invoke.mockResolvedValueOnce([{ pid: 1, user: "root", cpu: 5, mem: 1, name: "init" }]);
    await expect(listProcessesWeb()).resolves.toEqual([{ pid: 1, user: "root", cpu: 5, mem: 1, name: "init" }]);

    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue(undefined);
    await killProcessWeb(42);
    expect(mocks.invoke).toHaveBeenCalledWith("kill_process", { pid: 42 });
  });
});
