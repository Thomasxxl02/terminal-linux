import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import router from "./src/backend/routes";
import { setupWebSockets } from "./src/backend/sync";
import { PtyService } from "./src/backend/services";

export const app = express();
const PORT = 3000;
export const server = http.createServer(app);

// Enable trust proxy for reverse proxy environment (Cloud Run / Nginx reverse proxy)
app.set("trust proxy", 1);

// Express setup
app.use(express.json());

// Journalisation réelle des requêtes (méthode, chemin, statut final)
app.use((req, res, next) => {
  res.on("finish", () => {
    logRequest(req.method, req.originalUrl, res.statusCode);
  });
  next();
});

// Main modular routing delegation (HTTP logic separated!)
app.use("/api", router);

// Websockets initialization (Sync/WS logic separated!)
const { pingInterval } = setupWebSockets(server);

// Journal d'application RÉEL : chaque requête HTTP qui traverse le serveur
// Express est consignée dans /tmp/application.log (méthode, chemin, statut).
// Aucune ligne fictive — contrairement à l'ancien simulateur qui inventait
// des événements (tunnels SSH, purges disque…) présentés comme réels.
const APP_LOG_FILE = "/tmp/application.log";

export function initAppLog() {
  try {
    const dir = path.dirname(APP_LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      APP_LOG_FILE,
      `--- Serveur Express démarré le ${new Date().toISOString()} ---\n`
    );
  } catch (e) {
    console.error("Failed to initialize app log", e);
  }
}

export function logRequest(method: string, url: string, statusCode: number) {
  try {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const line = `[${now}] [INFO] ${statusCode} ${method.toUpperCase()} ${url}\n`;
    fs.appendFileSync(APP_LOG_FILE, line);

    // Rotation simple : on garde les 200 dernières lignes
    const content = fs.readFileSync(APP_LOG_FILE, "utf-8");
    const lines = content.split("\n");
    if (lines.length > 500) {
      fs.writeFileSync(APP_LOG_FILE, lines.slice(lines.length - 200).join("\n"));
    }
  } catch {
    // Journal indisponible (permissions) → on n'interrompt pas le serveur
  }
}

async function startServer() {
  // (Initialisation PostgreSQL supprimée : db.ts retiré — le frontend
  //  utilise localStorage/keyring, aucune table n'est requise.)

  // Journal d'application réel (requêtes serveur consignées)
  initAppLog();

  // Vite development middleware vs production bundle static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Rate limiting sur le fallback SPA : chaque requête déclenche un accès
    // disque (sendFile). Sans limite, un attaquant peut faire un DoS simple.
    const spaLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 600, // limit each IP to 600 SPA fallback requests per 15 minutes
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Trop de requêtes, veuillez réessayer plus tard." },
      skip: () => process.env.NODE_ENV === "test",
    });
    app.use(express.static(distPath));
    app.get("*", spaLimiter, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Pre-instantiate a default main session on start
  PtyService.getInstance().createSession("pty_default", "Terminal Principal - Bash", process.cwd());

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Linux Terminal Emulator Server running at http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  startServer();
}
