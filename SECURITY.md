# Politique de Sécurité (SECURITY.md)

Cette politique s'applique à **terminal-linux**, un émulateur de terminal Linux web (React + TypeScript) avec backend Node.js/Express, WebSocket, gestion PTY, et une couche desktop optionnelle Rust/Tauri.

---

## 🛡️ Mesures de sécurité réellement en place

Les protections suivantes sont implémentées dans le code source (vérifiables dans `src/backend/` et `server.ts`) :

### 1. Validation des entrées et anti path traversal
* `getSafePath()` (`src/backend/security.ts`) : résout les chemins et **refuse tout dépassement de l'arborescence du workspace** (`process.cwd()`) — utilisé par toutes les routes `/api/fs/*`.
* `getSafeLogPath()` : restriction des chemins de logs à `/tmp/application.log` ou au workspace.
* `validateString`, `validateOptionalString`, `validateInteger`, `validatePositiveInteger` : validation stricte de types pour éviter les attaques de type confusion / manipulation de paramètres.

### 2. Rate limiting (anti brute-force / anti abus)
* `apiLimiter` : **500 requêtes / 15 min / IP** appliqué à toutes les routes `/api/*`.
* `writeLimiter` : **60 opérations d'écriture / min / IP** sur les routes modifiant l'état (PTY, fichiers, DB).
* `express-rate-limit` avec `standardHeaders` et désactivation du `x-forwarded-for` non validé.

### 3. Authentification JWT (si `AUTH_SECRET` configuré)
* `src/backend/auth.ts` : JWT HMAC-SHA256 natif (sans dépendance), validé par `requireAuth` sur **toutes** les routes `/api/*` (sauf `/auth/login` et `/health`).
* Rôle (`admin` / `developer` / `guest`) **contenu dans le JWT signé** — le header `x-user-role` (précédemment spoofable) est **ignoré**.
* Échange : `POST /api/auth/login` avec un token statique (`ADMIN_TOKEN` / `DEV_TOKEN` / `GUEST_TOKEN` en env) → JWT 12 h.
* WebSocket `/ws/pty` et `/ws/logs` : JWT vérifié au handshake (`?token=`) — connexion refusée (401) sans token valide.
* Permissions RBAC existantes (`PermissionService`) désormais alimentées par le rôle du JWT.

### 4. Séparation des responsabilités
* `PermissionService` (`src/backend/services.ts`) : vérification de rôles sur les opérations sensibles (ex : `/system/kill-process`).
* Code modularisé : `routes.ts` (HTTP), `sync.ts` (WebSocket), `services.ts` (logique métier).

### 5. Gestion des secrets
* Clés API (ex : `GEMINI_API_KEY`) chargées via `dotenv` — **jamais dans le code source**.
* `.env*` ignoré par git (`.gitignore`), seul `.env.example` (sans secrets) est versionné.

### 6. Dépendances
* Override forcée de `dompurify` vers la version patchée (`3.4.13`) dans `package.json`.
* `SECURITY.md` vérifié par Dependabot sur les dépendances npm et crates Rust.

### 7. Stockage sécurisé des secrets (desktop)
* `src/backend/secrets.rs` (Rust) : commandes `secure_set` / `secure_get` / `secure_delete` basées sur le crate `keyring` — les secrets (hôtes SSH, profils shell, playbooks, snippets, skills, macros de maintenance) sont stockés dans le **keyring OS** (GNOME Keyring / macOS Keychain / Windows Credential Manager), pas dans le navigateur.
* Frontend : `useSecureStorage` (chargement async + **migration automatique** depuis l'ancien localStorage clair) pour toutes les données sensibles — commandes shell exécutables pouvant contenir des secrets ; `useLocalStorage` ne fait **plus de fausse obfuscation XOR** — il stocke en clair et est documenté comme non sécurisé (réservé aux préférences UI non confidentielles : thème Monaco, historique de commandes).
* Données **non sensibles** conservées en localStorage clair : `monaco_editor_settings` (préférences d'affichage), `tauri_linux_terminal_command_history` (historique de commandes, non confidentiel).

---

## ⚠️ Limitations connues (à prendre en compte)

Ces points sont **documentés comme faits** — ils doivent être corrigés avant toute exposition publique du serveur :

| # | Limitation | Localisation | Risque |
|---|---|---|---|
| 1 | **Auth désactivée si `AUTH_SECRET` absent** : sans cette variable d'environnement, toutes les routes restent ouvertes (comportement hérité, pratique pour le dev local mais **interdit en production**) | `auth.ts` | Déploiement sans `AUTH_SECRET` = aucune protection |
| 2 | **Tokens statiques en clair dans l'URL WebSocket** : le JWT transite en query param `?token=` sur `/ws/pty` et `/ws/logs` (loggé par les reverse proxies) | `sync.ts`, `TerminalView.tsx`, `LogsStreamer.tsx` | Fuite possible du JWT dans les logs serveur |
| 3 | **JWT en localStorage** : le token est stocké côté navigateur (XSS = vol de session) | `src/lib/api.ts` | À remplacer par des cookies `httpOnly` + CSRF si exposition publique |
| 4 | **`exec()` pour lister les processus** (commande statique, sans input utilisateur — pas d'injection directe, mais à remplacer par une lib dédiée) | `routes.ts` | Baisse de robustesse |
| 5 | **Aucun mécanisme de révocation de JWT** : un token volé reste valide 12 h | `auth.ts` | Rotation longue possible |

**Recommandation** : pour toute exposition publique, configurer `AUTH_SECRET` (min 32 caractères) + tokens statiques, et restreindre le bind (localhost ou reverse proxy).

---

## 🔒 Versions supportées

| Version | Support |
|---|---|
| `main` (développement) | ✅ Supportée — correctifs de sécurité appliqués |
| Versions taguées | ✅ Supportées |
| Autres branches | ❌ Non supportées |

---

## 📢 Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique** pour les problèmes de sécurité.

1. Utilisez le **GitHub Security Advisory** du dépôt : https://github.com/Thomasxxl02/terminal-linux/security/advisories
2. Incluez : type de vulnérabilité, étapes de reproduction, impact potentiel, version(s) affectée(s).

**Délais de réponse** :
* Vulnérabilité critique (exécution de code, fuite de données massives) : réponse sous **48 h**
* Vulnérabilité haute : réponse sous **72 h**
* Autres : réponse sous **5 jours ouvrés**

---

*Document rédigé à partir des faits observés dans le code source. Les limitations listées ci-dessus sont volontairement exposées pour être corrigées — toute déclaration de sécurité doit être vérifiable dans le dépôt.*
