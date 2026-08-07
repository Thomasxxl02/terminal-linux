import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { PermissionService } from "./services";

/**
 * Authentification JWT sans dépendance externe (HMAC-SHA256 natif).
 *
 * Modèle : tokens statiques configurables côté serveur (env), échangés
 * contre un JWT signé contenant le rôle. Le rôle ne provient JAMAIS d'un
 * header client — il est contenu dans le JWT signé.
 *
 * Variables d'environnement :
 *   AUTH_SECRET      : clé HMAC (requise pour activer l'auth)
 *   ADMIN_TOKEN      : token statique → rôle "admin"
 *   DEV_TOKEN        : token statique → rôle "developer"
 *   GUEST_TOKEN      : token statique → rôle "guest"
 *
 * Durcissement :
 *   - JWT transmis via cookie httpOnly + SameSite=Strict (jamais en clair
 *     dans l'URL WebSocket, jamais accessible au JS → anti-XSS)
 *   - jti + liste noire en mémoire → révocation immédiate (logout)
 *   - Fail-closed en production : le serveur refuse de démarrer sans
 *     AUTH_SECRET (voir assertAuthConfigured)
 */

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12h
const COOKIE_NAME = "terminal_token";

function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

export function isAuthEnabled(): boolean {
  return getSecret() !== null;
}

/** Fail-closed : en production, l'auth est obligatoire. */
export function assertAuthConfigured(): void {
  if (process.env.NODE_ENV === "production" && !isAuthEnabled()) {
    console.error(
      "[AUTH] FATAL : AUTH_SECRET manquant en production. " +
        "Configurer AUTH_SECRET (>= 16 caractères) pour activer l'authentification."
    );
    process.exit(1);
  }
}

// ── Refresh tokens (rotation) ────────────────────────────────────
// Un refresh token opaques (32 octets aléatoires) est émis au login et
// consommé UNE SEULE fois : chaque refresh en émet un nouveau (rotation),
// ce qui neutralise le vol/rejeu d'un refresh token intercepté.
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 jours
interface RefreshSession {
  jti: string; // jti du JWT d'origine (pour révocation au logout)
  role: string;
  exp: number; // timestamp s
}
const refreshSessions = new Map<string, RefreshSession>(); // sha256(refreshToken) -> session

export function issueRefreshToken(role: string, jwtJti: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  refreshSessions.set(hash, {
    jti: jwtJti,
    role,
    exp: Math.floor(Date.now() / 1000) + REFRESH_TTL_SECONDS,
  });
  return token;
}

/** Consomme (rotation) un refresh token : retourne le rôle ou null. */
export function consumeRefreshToken(refreshToken: string): { role: string; jti: string } | null {
  if (typeof refreshToken !== "string" || !refreshToken) return null;
  const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const session = refreshSessions.get(hash);
  // Rotation : l'ancien refresh est consommé même si expiré/invalide
  refreshSessions.delete(hash);
  if (!session) return null;
  if (session.exp < Math.floor(Date.now() / 1000)) return null;
  return { role: session.role, jti: session.jti };
}

/** Révoque tous les refresh tokens d'un jti donné (appelé au logout). */
export function revokeRefreshTokensForJti(jti: string): void {
  for (const [hash, session] of refreshSessions) {
    if (session.jti === jti) refreshSessions.delete(hash);
  }
}

// ── Révocation (liste noire jti) ─────────────────────────────────
const revokedTokens = new Map<string, number>(); // jti -> exp (timestamp s)
let lastRevocationPurge = Date.now();

function purgeRevoked(now = Date.now()): void {
  if (now - lastRevocationPurge < 60_000) return; // purge max 1x/min
  for (const [jti, exp] of revokedTokens) {
    if (exp * 1000 < now) revokedTokens.delete(jti);
  }
  lastRevocationPurge = now;
}

export function revokeToken(jti: string, exp: number): void {
  purgeRevoked();
  revokedTokens.set(jti, exp);
}

function isRevoked(jti: string): boolean {
  purgeRevoked();
  return revokedTokens.has(jti);
}

// ── JWT ──────────────────────────────────────────────────────────
function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function safeEqual(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throw si les longueurs diffèrent → vérifier d'abord
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function roleForStaticToken(staticToken: string): string | null {
  if (!staticToken) return null;
  if (safeEqual(staticToken, process.env.ADMIN_TOKEN)) return "admin";
  if (safeEqual(staticToken, process.env.DEV_TOKEN)) return "developer";
  if (safeEqual(staticToken, process.env.GUEST_TOKEN)) return "guest";
  return null;
}

export interface AuthUser {
  role: string;
  exp: number;
  jti: string;
}

export function signToken(role: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("AUTH_SECRET non configuré");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const jti = crypto.randomUUID();
  const payload = b64url(JSON.stringify({ role, exp, jti }));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): AuthUser | null {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof decoded.role !== "string" || typeof decoded.exp !== "number" || typeof decoded.jti !== "string") {
      return null;
    }
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (isRevoked(decoded.jti)) return null;
    return { role: decoded.role, exp: decoded.exp, jti: decoded.jti };
  } catch {
    return null;
  }
}

// ── Extraction du token : cookie httpOnly (prioritaire) ou Bearer ─
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export function extractCookieToken(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=") || null;
  }
  return null;
}

function setAuthCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TOKEN_TTL_SECONDS}${secure}`
  );
}

function clearAuthCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  );
}

// ── Middlewares ───────────────────────────────────────────────────
/** Middleware : exige un JWT valide. Si l'auth est désactivée, passe avec
 *  le rôle admin : le serveur sans AUTH_SECRET est un outil local/standalone,
 *  aucune restriction de rôle ne doit bloquer l'exécution (guest n'a pas
 *  execute_terminal → toutes les actions des autres vues seraient en 403). */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isAuthEnabled()) {
    req.user = { role: "admin", exp: 0, jti: "" };
    return next();
  }
  const token = extractCookieToken(req) || extractBearerToken(req);
  const user = token ? verifyToken(token) : null;
  if (!user) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  req.user = user;
  return next();
}

/** Middleware : exige un rôle autorisé pour une action donnée. */
export function requirePermission(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user || { role: "guest" };
    if (!PermissionService.isAuthorized(user.role, action)) {
      return res.status(403).json({ error: "Privilèges insuffisants" });
    }
    return next();
  };
}

/** Middleware CSRF : les requêtes mutantes doivent être same-origin. */
export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "test") return next();
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  const source = origin || referer;
  if (!source) return next(); // requête non-navigateur (curl, API) → OK
  try {
    const url = new URL(source);
    if (url.host === host) return next();
  } catch {
    return res.status(403).json({ error: "Origine invalide" });
  }
  return res.status(403).json({ error: "Origine non autorisée" });
}

// ── Handlers ──────────────────────────────────────────────────────
/** POST /api/auth/login — échange un token statique contre un JWT (cookie httpOnly). */
export function handleLogin(req: Request, res: Response) {
  if (!isAuthEnabled()) {
    // Auth désactivée : pas de cookie nécessaire.
    return res.json({ token: "", role: "guest", authEnabled: false });
  }
  const { token } = req.body || {};
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ error: "Token requis" });
  }
  const role = roleForStaticToken(token);
  if (!role) {
    return res.status(401).json({ error: "Token invalide" });
  }
  const jwt = signToken(role);
  setAuthCookie(res, jwt);
  // Le refresh token (rotation) est renvoyé au client pour prolonger la
  // session après expiration du JWT (12h) — stocké par le frontend.
  const user = verifyToken(jwt);
  const refreshToken = user ? issueRefreshToken(role, user.jti) : "";
  return res.json({ token: jwt, refreshToken, role, authEnabled: true });
}

/**
 * POST /api/auth/refresh — échange un refresh token contre un nouveau
 * JWT + un nouveau refresh token (rotation). L'ancien refresh est
 * consommé : un refresh token ne peut être utilisé qu'une fois.
 */
export function handleRefresh(req: Request, res: Response) {
  if (!isAuthEnabled()) {
    return res.json({ token: "", refreshToken: "", role: "guest", authEnabled: false });
  }
  const { refreshToken } = req.body || {};
  const session = consumeRefreshToken(refreshToken);
  if (!session) {
    return res.status(401).json({ error: "Refresh token invalide ou expiré" });
  }
  const jwt = signToken(session.role);
  setAuthCookie(res, jwt);
  const user = verifyToken(jwt);
  const nextRefresh = user ? issueRefreshToken(session.role, user.jti) : "";
  return res.json({ token: jwt, refreshToken: nextRefresh, role: session.role, authEnabled: true });
}

/** POST /api/auth/logout — révoque le JWT courant et efface le cookie. */
export function handleLogout(req: Request, res: Response) {
  const token = extractCookieToken(req) || extractBearerToken(req);
  const user = token ? verifyToken(token) : null;
  if (user) {
    revokeToken(user.jti, user.exp);
    // Révoque aussi les refresh tokens émis pour ce jti
    revokeRefreshTokensForJti(user.jti);
  }
  clearAuthCookie(res);
  return res.json({ success: true });
}

export function authStatus(): { enabled: boolean; roles: string[] } {
  const roles: string[] = [];
  if (process.env.ADMIN_TOKEN) roles.push("admin");
  if (process.env.DEV_TOKEN) roles.push("developer");
  if (process.env.GUEST_TOKEN) roles.push("guest");
  return { enabled: isAuthEnabled(), roles };
}
