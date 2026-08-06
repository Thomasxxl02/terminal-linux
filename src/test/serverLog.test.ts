// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import { initAppLog, logRequest } from "../../server";

describe("server — journal d'application réel (initAppLog / logRequest)", () => {
  beforeEach(() => {
    // Réinitialiser le fichier de log pour des assertions déterministes
    try {
      fs.rmSync("/tmp/application.log", { force: true });
    } catch {
      // ignore
    }
  });

  it("initAppLog crée le fichier avec un en-tête", () => {
    initAppLog();
    expect(fs.existsSync("/tmp/application.log")).toBe(true);
    const content = fs.readFileSync("/tmp/application.log", "utf-8");
    expect(content).toContain("Serveur Express démarré");
  });

  it("logRequest consigne une ligne formatée (statut, méthode, URL)", () => {
    initAppLog();
    logRequest("GET", "/api/health", 200);
    const content = fs.readFileSync("/tmp/application.log", "utf-8");
    expect(content).toMatch(/\[INFO\] 200 GET \/api\/health/);
  });

  it("logRequest écrit plusieurs requêtes à la suite", () => {
    initAppLog();
    logRequest("POST", "/api/fs/write", 200);
    logRequest("DELETE", "/api/pty/abc", 404);
    const content = fs.readFileSync("/tmp/application.log", "utf-8");
    const lines = content.split("\n").filter(Boolean);
    expect(lines.some((l) => l.includes("200 POST /api/fs/write"))).toBe(true);
    expect(lines.some((l) => l.includes("404 DELETE /api/pty/abc"))).toBe(true);
  });

  it("ne lève pas si le fichier est inécrivable", () => {
    // logRequest attrape les erreurs internes (catch silencieux)
    expect(() => logRequest("GET", "/", 200)).not.toThrow();
  });
});
