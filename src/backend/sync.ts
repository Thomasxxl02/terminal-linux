import http from "http";
import fs from "fs";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { PtyService } from "./services";
import { errMsg, getSafeLogPath } from "./security";
import { isAuthEnabled, verifyToken } from "./auth";

// Propriété interne de heartbeat ajoutée par ws (pattern officiel du README ws)
declare module "ws" {
  interface WebSocket {
    isAlive?: boolean;
  }
}

const ptyService = PtyService.getInstance();

export function setupWebSockets(server: http.Server) {
  const wssPty = new WebSocketServer({ noServer: true });
  const wssLogs = new WebSocketServer({ noServer: true });

  const HEARTBEAT_INTERVAL = 30000;

  const pingInterval = setInterval(() => {
    wssPty.clients.forEach((ws: WebSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });

    wssLogs.clients.forEach((ws: WebSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);

    // Anti-CSWSH : si un navigateur fournit un Origin, il doit être dans la
    // liste blanche (localhost web + webview Tauri). Les clients non-
    // navigateurs (ws CLI, tests) n'envoient pas d'Origin → acceptés.
    const origin = request.headers.origin;
    if (origin) {
      const allowedOrigins = (
        process.env.WS_ALLOWED_ORIGINS ||
        "http://localhost:3000,http://127.0.0.1:3000,tauri://localhost,http://tauri.localhost,https://tauri.localhost"
      )
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (!allowedOrigins.includes(origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    // Authentification WebSocket : le JWT est passé en query param (?token=...).
    // Si l'auth est désactivée (pas de AUTH_SECRET), connexion acceptée (hérité).
    if (isAuthEnabled()) {
      const token = url.searchParams.get("token");
      if (!token || !verifyToken(token)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    if (url.pathname.startsWith("/ws/pty")) {
      wssPty.handleUpgrade(request, socket, head, (ws) => {
        wssPty.emit("connection", ws, request);
      });
    } else if (url.pathname.startsWith("/ws/logs")) {
      wssLogs.handleUpgrade(request, socket, head, (ws) => {
        wssLogs.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // PTY Streams Connection Setup
  wssPty.on("connection", (ws: WebSocket, request: http.IncomingMessage) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const sessionId = url.searchParams.get("id");

    if (!sessionId) {
      ws.send(JSON.stringify({ type: "error", message: "ID de session requis" }));
      ws.close();
      return;
    }

    const session = ptyService.getSession(sessionId);
    if (!session) {
      ws.send(JSON.stringify({ type: "error", message: "Session non trouvée" }));
      ws.close();
      return;
    }

    session.clients.add(ws);

    ws.send(
      JSON.stringify({
        type: "connected",
        sessionId: session.id,
        cols: session.cols,
        rows: session.rows,
        cwd: session.cwd,
      })
    );

    if (session.buffer.length > 0) {
      ws.send(
        JSON.stringify({
          type: "output",
          data: session.buffer.join(""),
        })
      );
    }

    ws.on("message", (message: string | Buffer) => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.type === "input" && typeof msg.data === "string") {
          session.process.stdin.write(msg.data);
        } else if (msg.type === "resize" && msg.cols && msg.rows) {
          session.cols = msg.cols;
          session.rows = msg.rows;
          try {
            if (process.platform !== "win32") {
              session.process.kill("SIGWINCH");
            }
          } catch {
            // Ignore signals errors
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

  // Log Streams Connection Setup
  wssLogs.on("connection", (ws: WebSocket, request: http.IncomingMessage) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const rawLogPath = url.searchParams.get("path");
    const logPath = getSafeLogPath(rawLogPath);

    const tailer = new LogTailer(logPath, ws);
    tailer.start();

    ws.on("close", () => {
      tailer.stop();
    });
  });

  return { wssPty, wssLogs, pingInterval };
}

// Dedicated Real-time log file tracker
class LogTailer {
  private filePath: string;
  private ws: WebSocket;
  private isWatching: boolean = false;
  private watcher: NodeJS.Timeout | null = null;
  private lastSize: number = 0;

  constructor(filePath: string, ws: WebSocket) {
    this.filePath = filePath;
    this.ws = ws;
  }

  public async start() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        await fs.promises.writeFile(
          this.filePath,
          `--- Fichier de log créé par le visualiseur : ${path.basename(this.filePath)} ---\n`,
          "utf-8"
        );
      }

      const stat = await fs.promises.stat(this.filePath);
      this.lastSize = stat.size;
      this.isWatching = true;

      const historySize = Math.min(stat.size, 50 * 1024);
      if (historySize > 0) {
        const fd = await fs.promises.open(this.filePath, "r");
        const buf = Buffer.alloc(historySize);
        await fd.read(buf, 0, historySize, stat.size - historySize);
        await fd.close();
        this.ws.send(JSON.stringify({ type: "history", data: buf.toString("utf-8") }));
      }

      this.watcher = setInterval(async () => {
        if (!this.isWatching) return;
        try {
          if (!fs.existsSync(this.filePath)) return;
          const currStat = await fs.promises.stat(this.filePath);

          if (currStat.size > this.lastSize) {
            const addedSize = currStat.size - this.lastSize;
            const buf = Buffer.alloc(addedSize);
            const fd = await fs.promises.open(this.filePath, "r");
            await fd.read(buf, 0, addedSize, this.lastSize);
            await fd.close();

            this.lastSize = currStat.size;
            this.ws.send(JSON.stringify({ type: "log", data: buf.toString("utf-8") }));
          } else if (currStat.size < this.lastSize) {
            this.lastSize = currStat.size;
            this.ws.send(JSON.stringify({ type: "truncated" }));
          }
        } catch (e) {
          // Ignore files access error during rapid rotation
        }
      }, 100);

      this.ws.send(JSON.stringify({ type: "status", status: "tailing", path: this.filePath }));
    } catch (err) {
      this.ws.send(JSON.stringify({ type: "error", message: errMsg(err) }));
    }
  }

  public stop() {
    this.isWatching = false;
    if (this.watcher) {
      clearInterval(this.watcher);
      this.watcher = null;
    }
  }
}
