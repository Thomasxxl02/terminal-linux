#!/usr/bin/env node
/**
 * Copie monaco-editor (min/vs) vers public/monaco/vs pour un SELF-HOST
 * local — l'éditeur fonctionne hors-ligne (desktop Tauri) sans dépendre
 * du CDN jsdelivr.
 *
 * Exécuté avant build/dev (voir scripts package.json). ~24 Mo de fichiers
 * statiques servis à la demande par le loader AMD (pas dans le bundle JS).
 */
import { cpSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "monaco-editor", "min", "vs");
const dest = join(root, "public", "monaco", "vs");

if (!existsSync(src)) {
  console.error("[copy-monaco] node_modules/monaco-editor introuvable — npm install d'abord");
  process.exit(1);
}

// Copie complète (remplacement propre du dossier)
rmSync(dest, { recursive: true, force: true });
mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });

console.log(`[copy-monaco] monaco self-host prêt : ${dest}`);
