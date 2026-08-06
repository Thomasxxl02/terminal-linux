<div align="center">

# 🖥️ Terminal Linux Emulator

Émulateur de terminal Linux haute performance, fonctionnant dans le navigateur.

</div>

## ✨ Fonctionnalités

- **Terminal xterm.js** avec rendu WebGL, recherche et liens cliquables
- **Onglets multiples** avec profils shell (bash/zsh)
- **Éditeur de fichiers Monaco** intégré (lecture/écriture via API)
- **Gestion SSH** : hôtes, tunnels dynamiques et directs
- **Snippets** et **playbooks** réutilisables
- **Séquencier de maintenance** système (apt, docker, logs)
- **Surveillance système** : CPU, RAM, processus
- **Assistant IA** (Gemini) intégré
- **Mode desktop optionnel** via Tauri (Rust + portable-pty)

## 🚀 Démarrage local

**Prérequis :** Node.js 22+ (frontend), Rust stable + dépendances Tauri (desktop)

**Mode web (dev) :**
```bash
npm install
npm run dev
```
Le serveur démarre sur `http://localhost:3000` (backend Express + WebSocket, middleware Vite en dev).

**Mode desktop Tauri (Linux) :**
```bash
npm install
cd src-tauri && cargo check   # valider le backend Rust
npm run dev:tauri             # serveur Vite pur (frontend seul)
npx tauri dev                 # fenêtre native + PTY Rust (portable-pty)
```

> L'application cible est **Tauri** : le terminal (xterm.js) est branché sur les commandes Rust (`create_pty_session`, `write_pty_input`, `resize_pty_session`, `close_pty_session`) via `invoke()`, et la sortie PTY arrive par l'événement Tauri `pty-output`. Le backend Express/WebSocket reste disponible en mode web, mais n'est pas requis en desktop.

## 🧪 Tests

```bash
npm run lint        # tsc --noEmit
npm run test        # tests unitaires Vitest
npm run test:e2e    # tests Playwright
cd src-tauri && cargo test   # tests Rust (PTY bridge)
```

## ⚙️ Configuration

Copiez `.env.example` vers `.env.local` et renseignez :

| Variable | Requise | Description |
|---|---|---|
| `GEMINI_API_KEY` | Pour l'IA | Clé API Google Gemini |
| `APP_URL` | Déploiement | URL publique de l'app |

## 🏗️ Architecture

```
server.ts                  → Express + WebSocket + Vite middleware
src/backend/routes.ts      → API REST (/api/pty, /api/fs, /api/db, /api/system)
src/backend/sync.ts        → WebSocket (streaming PTY)
src/backend/services.ts    → PtyService, MaintenanceService, PermissionService
src/backend/db.ts          → PostgreSQL (hôtes SSH, snippets, playbooks)
src/backend/security.ts    → Validation d'entrées, anti path traversal
src-tauri/                 → Couche desktop optionnelle (Rust + portable-pty)
```

## 🛡️ Sécurité

Voir [SECURITY.md](SECURITY.md) pour les mesures en place et les limitations connues.

## 📝 Licence

Privé — usage interne.
