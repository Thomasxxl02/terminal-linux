import { describe, it, expect, vi, beforeEach } from "vitest";
import { secureGet, secureSet, secureDelete } from "../lib/secureStorage";

// ── Mocks : isTauri + tauriInvoke ──
const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(),
  tauriInvoke: vi.fn(),
}));

vi.mock("../lib/tauri", () => ({
  isTauri: mocks.isTauri,
  tauriInvoke: mocks.tauriInvoke,
}));

describe("secureStorage — mode web (localStorage clair documenté)", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.isTauri.mockReturnValue(false);
    mocks.tauriInvoke.mockReset();
  });

  it("secureGet lit depuis localStorage en mode web", async () => {
    localStorage.setItem("test-key", '"valeur"');
    await expect(secureGet("test-key")).resolves.toBe('"valeur"');
  });

  it("secureGet retourne null si la clé n'existe pas", async () => {
    await expect(secureGet("inexistante")).resolves.toBeNull();
  });

  it("secureSet écrit dans localStorage", async () => {
    await secureSet("k", "v");
    expect(localStorage.getItem("k")).toBe("v");
  });

  it("secureDelete efface la clé", async () => {
    localStorage.setItem("k", "v");
    await secureDelete("k");
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("ne fait JAMAIS appel à tauriInvoke en mode web", async () => {
    await secureGet("k");
    await secureSet("k", "v");
    await secureDelete("k");
    expect(mocks.tauriInvoke).not.toHaveBeenCalled();
  });
});

describe("secureStorage — mode Tauri (keyring OS)", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.isTauri.mockReturnValue(true);
    mocks.tauriInvoke.mockReset();
  });

  it("secureGet délègue à la commande secure_get", async () => {
    mocks.tauriInvoke.mockResolvedValue("secret");
    await expect(secureGet("ssh-key")).resolves.toBe("secret");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("secure_get", { key: "ssh-key" });
  });

  it("secureGet retourne null si le keyring échoue", async () => {
    mocks.tauriInvoke.mockRejectedValue(new Error("keyring verrouillé"));
    await expect(secureGet("ssh-key")).resolves.toBeNull();
  });

  it("secureSet délègue à secure_set", async () => {
    mocks.tauriInvoke.mockResolvedValue(undefined);
    await secureSet("ssh-key", "secret");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("secure_set", { key: "ssh-key", value: "secret" });
  });

  it("secureDelete délègue à secure_delete", async () => {
    mocks.tauriInvoke.mockResolvedValue(undefined);
    await secureDelete("ssh-key");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("secure_delete", { key: "ssh-key" });
  });
});
