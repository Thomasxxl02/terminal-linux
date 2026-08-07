#!/usr/bin/env node
/**
 * Smoke test du serveur de PRODUCTION (dist/server.cjs) — le livrable
 * réel n'est jamais exercé par les e2e (qui utilisent le serveur dev).
 *
 * Démarre le serveur buildé sur un port dédié, vérifie les routes
 * critiques (health, SPA, API PTY, monaco self-host), puis l'arrête.
 * Exit 0 = serveur de prod fonctionnel.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = join(root, "dist", "server.cjs");
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;

if (!existsSync(serverPath)) {
  console.error(`[smoke-prod] ${serverPath} introuvable — lancez 'npm run build' d'abord`);
  process.exit(1);
}

const server = spawn("node", [serverPath], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

async function waitReady() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // pas encore prêt
    }
    await sleep(200);
  }
  throw new Error(`Serveur non prêt après 10s\n${serverLog.slice(-500)}`);
}

async function check(name, fn) {
  try {
    const ok = await fn();
    if (ok) {
      console.log(`  ✓ ${name}`);
    } else {
      failures.push(name);
      console.error(`  ✗ ${name}`);
    }
  } catch (e) {
    failures.push(name);
    console.error(`  ✗ ${name} — ${e.message}`);
  }
}

try {
  await waitReady();
  console.log("[smoke-prod] Serveur de production démarré ✓");

  await check("GET /api/health → 200", async () => {
    const res = await fetch(`${BASE}/api/health`);
    return res.ok;
  });

  await check("GET / → SPA (index.html réel)", async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    return res.ok && html.includes("<div id=\"root\"") && html.includes("assets/");
  });

  await check("GET /api/pty/sessions → JSON", async () => {
    const res = await fetch(`${BASE}/api/pty/sessions`);
    const json = await res.json();
    return res.ok && Array.isArray(json.sessions);
  });

  await check("GET /api/system/stats → JSON complet", async () => {
    const res = await fetch(`${BASE}/api/system/stats`);
    const json = await res.json();
    return res.ok && typeof json.cpus === "number" && typeof json.memUsagePercent === "number";
  });

  await check("GET /monaco/vs/loader.js → 200 (self-host)", async () => {
    const res = await fetch(`${BASE}/monaco/vs/loader.js`);
    const text = await res.text();
    return res.ok && text.includes("require");
  });

  await check("GET /chemin/inconnu → fallback SPA (pas 404 nu)", async () => {
    const res = await fetch(`${BASE}/route-inexistante-xyz`);
    const html = await res.text();
    return html.includes("<div id=\"root\"");
  });
} catch (e) {
  console.error(`[smoke-prod] ${e.message}`);
  failures.push("démarrage");
} finally {
  server.kill("SIGTERM");
  await sleep(300);
}

if (failures.length > 0) {
  console.error(`[smoke-prod] ${failures.length} vérification(s) échouée(s) : ${failures.join(", ")}`);
  process.exit(1);
}
console.log("[smoke-prod] Serveur de production : toutes les vérifications passent ✓");
