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

**Prérequis :** Node.js 22+

```bash
npm install
npm run dev
```

Le serveur démarre sur `http://localhost:3000` (backend Express + WebSocket, middleware Vite en dev).

> Note : le mode desktop (`src-tauri/`) nécessite Rust et les dépendances système Tauri. L'application web est entièrement autonome sans cette couche.

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
