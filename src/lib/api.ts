/**
 * Client API frontend : gère le JWT et injecte le header Authorization
 * sur chaque requête fetch. Si l'auth est désactivée côté serveur,
 * les requêtes passent sans token (comportement hérité).
 */

const TOKEN_KEY = "terminal_linux_jwt";
const ROLE_KEY = "terminal_linux_role";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY);
}

export function setAuth(token: string, role: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/** Login : échange un token statique contre un JWT. */
export async function login(staticToken: string): Promise<{ token: string; role: string; authEnabled: boolean }> {
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
  return fetch(url, { ...options, headers });
}

/** Ajoute le JWT en query param pour les connexions WebSocket. */
export function wsUrlWithToken(baseUrl: string): string {
  const token = getToken();
  if (!token) return baseUrl;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}
