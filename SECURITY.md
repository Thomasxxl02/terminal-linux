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

### 3. Séparation des responsabilités
* `PermissionService` (`src/backend/services.ts`) : vérification de rôles (`admin`, etc.) sur les opérations sensibles (ex : `/system/kill-process`).
* Code modularisé : `routes.ts` (HTTP), `sync.ts` (WebSocket), `services.ts` (logique métier).

### 4. Gestion des secrets
* Clés API (ex : `GEMINI_API_KEY`) chargées via `dotenv` — **jamais dans le code source**.
* `.env*` ignoré par git (`.gitignore`), seul `.env.example` (sans secrets) est versionné.

### 5. Dépendances
* Override forcée de `dompurify` vers la version patchée (`3.4.13`) dans `package.json`.
* `SECURITY.md` vérifié par Dependabot sur les dépendances npm et crates Rust.

---

## ⚠️ Limitations connues (à prendre en compte)

Ces points sont **documentés comme faits** — ils doivent être corrigés avant toute exposition publique du serveur :

| # | Limitation | Localisation | Risque |
|---|---|---|---|
| 1 | **Aucune authentification réelle** : le rôle est lu depuis l'en-tête HTTP `x-user-role`, **spoofable par le client** | `routes.ts` (`kill-process`, `maintenance`) | Un client peut s'auto-attribuer le rôle `admin` |
| 2 | **Aucune authentification sur les routes FS/PTY/DB** : `/api/fs/*`, `/api/pty/*`, `/api/db/*` sont accessibles sans login | `routes.ts` | Lecture/écriture/suppression de fichiers par quiconque peut joindre le serveur |
| 3 | **WebSocket sans authentification** : pas de `verifyClient`, pas de vérification d'origine | `sync.ts` | Connexion PTY ouverte à tout client |
| 4 | **Serveur lié sur `0.0.0.0`** | `server.ts` | Exposition réseau complète |
| 5 | **`exec()` pour lister les processus** (commande statique, sans input utilisateur — pas d'injection directe, mais à remplacer par une lib dédiée) | `routes.ts` | Baisse de robustesse |

**Recommandation** : ne pas déployer ce serveur sur Internet sans avoir ajouté une authentification réelle (session/JWT), un `verifyClient` WebSocket, et une restriction du bind (localhost ou reverse proxy avec auth).

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
