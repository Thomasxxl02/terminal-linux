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
 * Si AUTH_SECRET n'est pas défini, l'auth est désactivée (comportement
 * hérité) et un avertissement est émis au démarrage.
 */

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12h

function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

export function isAuthEnabled(): boolean {
  return getSecret() !== null;
}

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
}

export function signToken(role: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("AUTH_SECRET non configuré");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = b64url(JSON.stringify({ role, exp }));
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
    if (typeof decoded.role !== "string" || typeof decoded.exp !== "number") return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { role: decoded.role, exp: decoded.exp };
  } catch {
    return null;
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/** Middleware : exige un JWT valide. Si l'auth est désactivée, passe (rôle guest). */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isAuthEnabled()) {
    (req as any).user = { role: "guest", exp: 0 };
    return next();
  }
  const token = extractBearerToken(req);
  const user = token ? verifyToken(token) : null;
  if (!user) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  (req as any).user = user;
  return next();
}

/** Middleware : exige un rôle autorisé pour une action donnée. */
export function requirePermission(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user || { role: "guest" };
    if (!PermissionService.isAuthorized(user.role, action)) {
      return res.status(403).json({ error: "Privilèges insuffisants" });
    }
    return next();
  };
}

/** Gestionnaire POST /api/auth/login — échange un token statique contre un JWT. */
export function handleLogin(req: Request, res: Response) {
  if (!isAuthEnabled()) {
    // Auth désactivée : retourner un token "guest" pour compatibilité.
    return res.json({ token: signToken("guest"), role: "guest", authEnabled: false });
  }
  const { token } = req.body || {};
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ error: "Token requis" });
  }
  const role = roleForStaticToken(token);
  if (!role) {
    return res.status(401).json({ error: "Token invalide" });
  }
  return res.json({ token: signToken(role), role, authEnabled: true });
}

export function authStatus(): { enabled: boolean; roles: string[] } {
  const roles: string[] = [];
  if (process.env.ADMIN_TOKEN) roles.push("admin");
  if (process.env.DEV_TOKEN) roles.push("developer");
  if (process.env.GUEST_TOKEN) roles.push("guest");
  return { enabled: isAuthEnabled(), roles };
}
