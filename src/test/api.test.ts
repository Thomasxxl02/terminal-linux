import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getToken,
  getRole,
  setAuth,
  clearAuth,
  isAuthenticated,
  login,
  logout,
  apiFetch,
  tryRefresh,
  wsUrlWithToken,
} from "../lib/api";

describe("api — gestion du token JWT (localStorage)", () => {
  beforeEach(() => localStorage.clear());

  it("setAuth stocke token + rôle ; getToken/getRole les relisent", () => {
    setAuth("jwt-abc", "admin");
    expect(getToken()).toBe("jwt-abc");
    expect(getRole()).toBe("admin");
  });

  it("clearAuth efface token et rôle", () => {
    setAuth("jwt-abc", "admin");
    clearAuth();
    expect(getToken()).toBeNull();
    expect(getRole()).toBeNull();
  });

  it("isAuthenticated est vrai si un token existe", () => {
    expect(isAuthenticated()).toBe(false);
    setAuth("t", "dev");
    expect(isAuthenticated()).toBe(true);
  });
});

describe("api — login", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("login POST le token statique et retourne JWT + rôle", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "jwt-1", role: "admin", authEnabled: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await login("secret-admin");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "secret-admin" }),
      })
    );
    expect(result).toEqual({ token: "jwt-1", role: "admin", authEnabled: true });
  });

  it("login lève l'erreur serveur si non-OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Token invalide" }) })
    );
    await expect(login("mauvais")).rejects.toThrow("Token invalide");
  });

  it("login lève un message par défaut si l'erreur n'est pas JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new Error("pas json"); } })
    );
    await expect(login("mauvais")).rejects.toThrow("Échec de l'authentification");
  });
});

describe("api — logout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("logout appelle la route serveur puis efface le token local", async () => {
    setAuth("jwt-1", "admin");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );

    await logout();
    expect(getToken()).toBeNull();
    expect(getRole()).toBeNull();
  });

  it("logout nettoie localement même si le serveur est injoignable", async () => {
    setAuth("jwt-1", "admin");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await logout();
    expect(getToken()).toBeNull();
  });
});

describe("api — apiFetch (injection JWT)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("n'injecte pas de header sans token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/fs/tree");
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  it("injecte Authorization: Bearer <token>", async () => {
    setAuth("jwt-xyz", "dev");
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/fs/tree", { method: "GET" });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer jwt-xyz");
  });

  it("préserve les headers existants", async () => {
    setAuth("t", "d");
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/x", {
      headers: { "Content-Type": "application/json" },
    });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer t");
  });
});

describe("api — wsUrlWithToken", () => {
  beforeEach(() => localStorage.clear());

  it("retourne l'URL inchangée sans token", () => {
    expect(wsUrlWithToken("ws://localhost:3000/ws")).toBe("ws://localhost:3000/ws");
  });

  it("ajoute ?token= si l'URL n'a pas de query", () => {
    setAuth("jwt-tok", "admin");
    const url = wsUrlWithToken("ws://localhost:3000/ws");
    expect(url).toBe("ws://localhost:3000/ws?token=jwt-tok");
  });

  it("ajoute &token= si l'URL a déjà une query", () => {
    setAuth("jwt-tok", "admin");
    const url = wsUrlWithToken("ws://localhost:3000/ws?a=1");
    expect(url).toBe("ws://localhost:3000/ws?a=1&token=jwt-tok");
  });

  it("encode le token dans l'URL", () => {
    setAuth("token avec espaces+/=", "admin");
    const url = wsUrlWithToken("ws://host/ws");
    expect(url).toContain(encodeURIComponent("token avec espaces+/="));
  });
});

describe("api — refresh token (rotation côté client)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("setAuth stocke aussi le refresh token", () => {
    setAuth("jwt-1", "admin", "refresh-abc");
    expect(localStorage.getItem("terminal_linux_refresh")).toBe("refresh-abc");
  });

  it("clearAuth efface aussi le refresh token", () => {
    setAuth("jwt-1", "admin", "refresh-abc");
    clearAuth();
    expect(localStorage.getItem("terminal_linux_refresh")).toBeNull();
  });

  it("tryRefresh échange le refresh contre un nouveau JWT + refresh", async () => {
    setAuth("jwt-old", "admin", "refresh-old");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "jwt-new", refreshToken: "refresh-new", role: "admin" }),
      })
    );

    const ok = await tryRefresh();
    expect(ok).toBe(true);
    expect(getToken()).toBe("jwt-new");
    expect(localStorage.getItem("terminal_linux_refresh")).toBe("refresh-new");
  });

  it("tryRefresh échoue et efface l'auth si le serveur refuse", async () => {
    setAuth("jwt-old", "admin", "refresh-old");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    );

    const ok = await tryRefresh();
    expect(ok).toBe(false);
    expect(getToken()).toBeNull();
    expect(localStorage.getItem("terminal_linux_refresh")).toBeNull();
  });

  it("tryRefresh sans refresh token stocké → false sans appel réseau", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ok = await tryRefresh();
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("apiFetch rejoue la requête après un refresh réussi (401 → 200)", async () => {
    setAuth("jwt-expired", "admin", "refresh-ok");

    const fetchMock = vi
      .fn()
      // 1er appel : la requête protégée → 401
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      // 2e appel : le refresh → OK
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "jwt-new", refreshToken: "refresh-new", role: "admin" }),
      })
      // 3e appel : la requête rejouée → 200
      .mockResolvedValueOnce(new Response("data", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch("/api/fs/tree");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getToken()).toBe("jwt-new");
  });

  it("apiFetch ne rejoue pas si le refresh échoue (401 final)", async () => {
    setAuth("jwt-expired", "admin", "refresh-mort");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch("/api/fs/tree");
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getToken()).toBeNull();
  });

  it("apiFetch ne tente pas de refresh sur les routes /api/auth/*", async () => {
    setAuth("jwt", "admin", "refresh");
    const fetchMock = vi.fn().mockResolvedValue(new Response("x", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
