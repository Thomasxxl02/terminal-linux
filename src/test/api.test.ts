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
