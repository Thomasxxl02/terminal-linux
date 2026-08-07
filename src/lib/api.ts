/**
 * Client API frontend : gère le JWT et injecte le header Authorization
 * sur chaque requête fetch. Si l'auth est désactivée côté serveur,
 * les requêtes passent sans token (comportement hérité).
 */

const TOKEN_KEY = "terminal_linux_jwt";
const ROLE_KEY = "terminal_linux_role";
const REFRESH_KEY = "terminal_linux_refresh";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY);
}

export function setAuth(token: string, role: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/** Login : échange un token statique contre un JWT + refresh token. */
export async function login(
  staticToken: string
): Promise<{ token: string; refreshToken?: string; role: string; authEnabled: boolean }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: staticToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Échec de l'authentification");
  }
  return res.json();
}

/**
 * Logout : révoque le JWT côté serveur (blacklist jti) puis efface
 * le token et le rôle localement. Ne lève pas si le serveur est injoignable
 * (le nettoyage local suffit dans ce cas).
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (e) {
    console.warn("[api] Logout serveur indisponible, nettoyage local uniquement", e);
  } finally {
    clearAuth();
  }
}

/** Fetch avec JWT injecté automatiquement. */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  let res = await fetch(url, { ...options, headers });

  // 401 sur une route protégée → tenter un refresh (une seule fois),
  // puis rejouer la requête avec le nouveau JWT. Évite les routes
  // /api/auth/* (login/refresh/logout) pour ne pas boucler.
  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const headers2 = new Headers(options.headers || {});
      const t2 = getToken();
      if (t2) {
        headers2.set("Authorization", `Bearer ${t2}`);
      }
      res = await fetch(url, { ...options, headers: headers2 });
    }
  }
  return res;
}

// ── Refresh token (rotation) ──────────────────────────────────────
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Échange le refresh token contre un nouveau JWT + refresh token.
 * Mutex : plusieurs 401 simultanés ne déclenchent qu'UN seul refresh.
 * Échec (invalide/expiré/serveur injoignable) → clearAuth() (session finie).
 */
export async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearAuth();
      return false;
    }
    const data = await res.json();
    if (!data.token) {
      clearAuth();
      return false;
    }
    setAuth(data.token, data.role, data.refreshToken);
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

/** Ajoute le JWT en query param pour les connexions WebSocket. */
export function wsUrlWithToken(baseUrl: string): string {
  const token = getToken();
  if (!token) return baseUrl;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}
