import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import router from "./src/backend/routes";
import { setupWebSockets } from "./src/backend/sync";
import { initializeDatabaseSchema } from "./src/backend/db";
import { PtyService } from "./src/backend/services";

export const app = express();
const PORT = 3000;
export const server = http.createServer(app);

// Enable trust proxy for reverse proxy environment (Cloud Run / Nginx reverse proxy)
app.set("trust proxy", 1);

// Express setup
app.use(express.json());

// Main modular routing delegation (HTTP logic separated!)
app.use("/api", router);

// Websockets initialization (Sync/WS logic separated!)
const { pingInterval } = setupWebSockets(server);

// Background Live Log Simulator
const SIMULATED_LOG_FILE = "/tmp/application.log";
function startSimulatedLogs() {
  try {
    const dir = path.dirname(SIMULATED_LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      SIMULATED_LOG_FILE,
      "--- Émulateur Linux - Initialisation du Journal d'Application ---\n[SUCCESS] Système démarré avec succès en mode asynchrone\n"
    );

    const logs = [
      "[INFO] 200 GET /api/health - En attente de requêtes",
      "[INFO] 200 GET /api/pty/sessions - 1 sessions actives",
      "[WARN] 404 GET /assets/favicon-old.ico - Ressource non trouvée",
      "[SUCCESS] 101 Connection Upgrade - PTY terminal WebSocket connecté",
      "[INFO] Processus de maintenance apt-clean démarré",
      "[SUCCESS] Cache utilisateur nettoyé avec succès en 42ms",
      "[INFO] Surveillance CPU: usage moyen 14.2% sur 4 vCPUs",
      "[WARN] Consommation RAM élevée: 82% d'utilisation sur l'hôte",
      "[ERROR] 500 POST /api/fs/delete - Erreur de permission sur /root/.bashrc",
      "[INFO] Tâche de nettoyage cron démarrée pour la purge des logs",
      "[SUCCESS] Purge effectuée: 14.5Mo libérés sur le disque",
      "[ERROR] Connexion SSH échouée: Connection timeout pour l'hôte 192.168.1.50:22",
      "[INFO] Tentative de reconnexion au tunnel SSH dynamique port 8080...",
      "[SUCCESS] Tunnel SSH établi avec succès pour la session #42",
      "[INFO] 200 GET /api/system/stats - Télémétries actualisées",
    ];

    setInterval(() => {
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      const randomLog = logs[Math.floor(Math.random() * logs.length)];
      const line = `[${now}] ${randomLog}\n`;
      try {
        fs.appendFileSync(SIMULATED_LOG_FILE, line);

        const content = fs.readFileSync(SIMULATED_LOG_FILE, "utf-8");
        const lines = content.split("\n");
        if (lines.length > 500) {
          fs.writeFileSync(SIMULATED_LOG_FILE, lines.slice(lines.length - 200).join("\n"));
        }
      } catch (err) {
        console.error("Failed to write simulated logs:", err);
      }
    }, 2000);
  } catch (e) {
    console.error("Failed to initialize simulated logs", e);
  }
}

async function startServer() {
  // Initialize Database schemas (PostgreSQL connection setup)
  await initializeDatabaseSchema();

  // Start background logging
  startSimulatedLogs();

  // Vite development middleware vs production bundle static serving
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

  // Pre-instantiate a default main session on start
  PtyService.getInstance().createSession("pty_default", "Terminal Principal - Bash", process.cwd());

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Linux Terminal Emulator Server running at http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  startServer();
}
