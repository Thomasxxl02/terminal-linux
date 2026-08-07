// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "http";
import fs from "fs";
import path from "path";
import { WebSocket } from "ws";
import { setupWebSockets } from "../backend/sync";
import { PtyService } from "../backend/services";

// Auth désactivée par défaut en test (pas de AUTH_SECRET) → connexion
// WebSocket acceptée sans token (comportement hérité documenté).

function startServer(): Promise<{
  server: http.Server;
  port: number;
  stop: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => res.end("ok"));
    setupWebSockets(server);
    server.listen(0, () => {
      const address = server.address() as { port: number };
      resolve({
        server,
        port: address.port,
        stop: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

interface TestWs extends WebSocket {
  __queue: unknown[];
  __waiters: ((msg: unknown) => void)[];
}

function connect(port: number, path: string, origin?: string): Promise<TestWs> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
      headers: origin ? { Origin: origin } : undefined,
    }) as TestWs;
    ws.__queue = [];
    ws.__waiters = [];

    // Bufferiser tous les messages dès la création pour éviter la race
    // entre le "open" et le 1er message serveur (connected/output/status).
    ws.on("message", (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        parsed = data.toString();
      }
      if (ws.__waiters.length > 0) {
        const waiter = ws.__waiters.shift()!;
        waiter(parsed);
      } else {
        ws.__queue.push(parsed);
      }
    });

    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function nextMessage(ws: TestWs, timeoutMs = 3000): Promise<unknown> {
  if (ws.__queue.length > 0) {
    return Promise.resolve(ws.__queue.shift());
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timeout message WS")),
      timeoutMs
    );
    ws.__waiters.push((msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

describe("WebSockets (sync.ts) — flux PTY et logs", () => {
  let env: { server: http.Server; port: number; stop: () => Promise<void> };
  let ptyService: PtyService;
  let createdSessionId: string;

  beforeAll(async () => {
    env = await startServer();
    ptyService = PtyService.getInstance();
  });

  afterAll(async () => {
    ptyService.shutdownAll();
    if (env) await env.stop();
  });

  it("rejette une connexion vers un chemin inconnu (destroy silencieux)", async () => {
    // Un chemin inconnu détruit la socket sans réponse
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${env.port}/ws/inconnu`);
      ws.on("close", () => resolve());
      ws.on("error", () => resolve());
      // Timeout de sécurité
      setTimeout(() => resolve(), 500);
    });
  });

  it("rejette un Origin interdit (anti-CSWSH → 403)", async () => {
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${env.port}/ws/pty`, {
        headers: { Origin: "https://evil.example.com" },
      });
      let saw403 = false;
      ws.on("unexpected-response", (_req, res) => {
        saw403 = res.statusCode === 403;
        res.destroy();
        resolve();
      });
      ws.on("close", () => resolve());
      ws.on("error", () => resolve());
      setTimeout(() => {
        expect(saw403).toBe(true);
        resolve();
      }, 1000);
    });
  });

  it("accepte un Origin localhost (anti-CSWSH → passage)", async () => {
    const session = ptyService.createSession(
      `ws_origin_${Date.now()}`,
      "Origin OK",
      process.cwd()
    );
    const ws = await connect(env.port, `/ws/pty?id=${session.id}`, "http://localhost:3000");
    // Si l'origin est acceptée, la session répond connected (le buffer du
    // shell peut précéder → on cherche le message connected)
    let connected = false;
    for (let i = 0; i < 5; i++) {
      const msg = (await nextMessage(ws)) as { type: string };
      if (msg.type === "connected") {
        connected = true;
        break;
      }
    }
    expect(connected).toBe(true);
    ws.close();
    ptyService.deleteSession(session.id);
  });

  it("rejette une connexion PTY sans id de session", async () => {
    const ws = await connect(env.port, "/ws/pty");
    const msg = (await nextMessage(ws)) as { type: string; message: string };
    expect(msg.type).toBe("error");
    expect(msg.message).toContain("ID de session");
    ws.close();
  });

  it("rejette une connexion PTY avec un id inexistant", async () => {
    const ws = await connect(env.port, "/ws/pty?id=inconnu");
    const msg = (await nextMessage(ws)) as { type: string; message: string };
    expect(msg.type).toBe("error");
    expect(msg.message).toContain("Session non trouvée");
    ws.close();
  });

  it("connecte une session PTY existante et envoie l'état connected", async () => {
    const session = ptyService.createSession(
      `ws_test_${Date.now()}`,
      "Test WS",
      process.cwd()
    );
    createdSessionId = session.id;

    const ws = await connect(env.port, `/ws/pty?id=${session.id}`);
    const msg = (await nextMessage(ws)) as { type: string; sessionId: string; cols: number };
    expect(msg.type).toBe("connected");
    expect(msg.sessionId).toBe(session.id);
    expect(msg.cols).toBeGreaterThan(0);
    ws.close();
  });

  it("diffuse le buffer existant à la connexion (type output)", async () => {
    const session = ptyService.getSession(createdSessionId);
    expect(session).toBeDefined();
    if (!session) return;

    session.buffer.push("echo depuis le buffer\n");

    const ws = await connect(env.port, `/ws/pty?id=${createdSessionId}`);
    // 1er message : connected ; 2e : output (buffer)
    const first = (await nextMessage(ws)) as { type: string };
    expect(first.type).toBe("connected");
    const msg = (await nextMessage(ws)) as { type: string; data: string };
    expect(msg.type).toBe("output");
    expect(msg.data).toContain("echo depuis le buffer");
    ws.close();
  });

  it("suit un fichier de log réel (status + history)", async () => {
    // Le chemin doit rester DANS le workspace (getSafeLogPath rejette /tmp)
    const logPath = path.join(process.cwd(), `.ws-tailer-test-${Date.now()}.log`);
    const ws = await connect(env.port, `/ws/logs?path=${encodeURIComponent(logPath)}`);

    // Le fichier vient d'être initialisé → 1er message "history" (contenu
    // d'initialisation) puis "status" ; l'ordre peut varier selon le timing.
    const first = (await nextMessage(ws)) as { type: string; status?: string };
    expect(["status", "history"]).toContain(first.type);

    const second = (await nextMessage(ws)) as { type: string; status?: string };
    expect(["status", "history"]).toContain(second.type);
    // Au moins un des deux est "status" (le tailer est actif)
    const statusMsg = first.type === "status" ? first : second;
    expect(statusMsg.status).toBe("tailing");

    // Le fichier est créé par le tailer (écriture async → petite attente)
    await new Promise((r) => setTimeout(r, 200));
    expect(fs.existsSync(logPath)).toBe(true);

    ws.close();

    // Nettoyage : le fichier de test ne doit pas polluer le workspace
    fs.rmSync(logPath, { force: true });
  });

  it("désinscrit le client PTY à la fermeture", async () => {
    const session = ptyService.createSession(
      `ws_close_${Date.now()}`,
      "Close Test",
      process.cwd()
    );
    const before = session.clients.size;

    const ws = await connect(env.port, `/ws/pty?id=${session.id}`);
    await nextMessage(ws); // connected
    expect(session.clients.size).toBe(before + 1);

    ws.close();
    // La fermeture est async côté serveur → petite attente
    await new Promise((r) => setTimeout(r, 100));
    expect(session.clients.size).toBe(before);
  });

  it("deleteSession ferme les clients WebSocket (anti-fuite de sockets)", async () => {
    const session = ptyService.createSession(
      `ws_del_${Date.now()}`,
      "Delete Test",
      process.cwd()
    );
    const ws = await connect(env.port, `/ws/pty?id=${session.id}`);
    await nextMessage(ws); // connected

    let closed = false;
    ws.on("close", () => {
      closed = true;
    });

    ptyService.deleteSession(session.id);

    // La socket est fermée par le serveur (close propre)
    await new Promise((r) => setTimeout(r, 200));
    expect(closed).toBe(true);
  });

  it("ignore un message d'entrée WS de plus de 64 Ko", async () => {
    const session = ptyService.createSession(
      `ws_big_${Date.now()}`,
      "Big Input Test",
      process.cwd()
    );
    const ws = await connect(env.port, `/ws/pty?id=${session.id}`);
    await nextMessage(ws); // connected

    // Spy sur stdin.write pour vérifier ce qui est écrit
    const writeSpy = vi.spyOn(session.process.stdin, "write");

    // Petit message → écrit
    ws.send(JSON.stringify({ type: "input", data: "echo ok\n" }));
    // Gros message (> 64 Ko) → ignoré
    ws.send(JSON.stringify({ type: "input", data: "x".repeat(70 * 1024) }));

    await new Promise((r) => setTimeout(r, 300));

    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenCalledWith("echo ok\n");
    writeSpy.mockRestore();
    ws.close();
    ptyService.deleteSession(session.id);
  });
});
