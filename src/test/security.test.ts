// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  errMsg,
  getSafePath,
  getSafeLogPath,
  validateString,
  validateOptionalString,
  validateInteger,
  validatePositiveInteger,
} from "../backend/security";

const cwd = process.cwd();

describe("security.errMsg", () => {
  it("extrait le message d'une Error", () => {
    expect(errMsg(new Error("boom"))).toBe("boom");
  });

  it("retourne les chaînes telles quelles", () => {
    expect(errMsg("direct")).toBe("direct");
  });

  it("sérialise les objets en JSON", () => {
    expect(errMsg({ a: 1 })).toBe('{"a":1}');
  });

  it("retourne un fallback pour les valeurs non sérialisables", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(errMsg(circular)).toBe("Erreur inconnue");
  });
});

describe("security.getSafePath (anti path traversal)", () => {
  it("retourne le cwd si l'entrée n'est pas une chaîne", () => {
    expect(getSafePath(null)).toBe(cwd);
    expect(getSafePath(42 as unknown as string)).toBe(cwd);
    expect(getSafePath("")).toBe(cwd);
  });

  it("résout un chemin relatif dans l'arborescence", () => {
    expect(getSafePath("src/backend")).toBe(pathJoin(cwd, "src/backend"));
  });

  it("lève une erreur sur tentative d'échappement (../..)", () => {
    expect(() => getSafePath("../../etc/passwd")).toThrow("Accès interdit");
  });

  it("lève une erreur sur chemin absolu hors workspace", () => {
    expect(() => getSafePath("/etc/passwd")).toThrow("Accès interdit");
  });
});

describe("security.getSafeLogPath", () => {
  it("retourne le log par défaut si l'entrée est invalide", () => {
    expect(getSafeLogPath(null)).toBe("/tmp/application.log");
    expect(getSafeLogPath("")).toBe("/tmp/application.log");
  });

  it("accepte le chemin par défaut", () => {
    expect(getSafeLogPath("/tmp/application.log")).toBe("/tmp/application.log");
  });

  it("résout un chemin dans le workspace", () => {
    expect(getSafeLogPath("logs/app.log")).toBe(pathJoin(cwd, "logs/app.log"));
  });

  it("retombe sur le défaut si le chemin est hors workspace", () => {
    expect(getSafeLogPath("../../tmp/evil.log")).toBe("/tmp/application.log");
  });
});

describe("security.validateString / validateOptionalString", () => {
  it("valide une chaîne et la retourne", () => {
    expect(validateString("bonjour", "nom")).toBe("bonjour");
  });

  it("lève sur un type non-chaîne", () => {
    expect(() => validateString(42 as unknown as string, "nom")).toThrow("'nom'");
    expect(() => validateString(["a"], "nom")).toThrow("'nom'");
    expect(() => validateString({}, "nom")).toThrow("'nom'");
  });

  it("validateOptionalString accepte undefined", () => {
    expect(validateOptionalString(undefined, "nom")).toBeUndefined();
    expect(validateOptionalString("v", "nom")).toBe("v");
    expect(() => validateOptionalString(5 as unknown as string, "n")).toThrow("'n'");
  });
});

describe("security.validateInteger / validatePositiveInteger", () => {
  it("valide un entier et le retourne", () => {
    expect(validateInteger(42, "port")).toBe(42);
    expect(validateInteger("42", "port")).toBe(42);
  });

  it("lève sur un non-entier", () => {
    expect(() => validateInteger(42.5, "port")).toThrow("'port'");
    expect(() => validateInteger("abc", "port")).toThrow("'port'");
    expect(() => validateInteger(NaN, "port")).toThrow("'port'");
    expect(() => validateInteger(undefined, "port")).toThrow("'port'");
  });

  it("validatePositiveInteger lève sur zéro ou négatif", () => {
    expect(validatePositiveInteger(10, "port")).toBe(10);
    expect(() => validatePositiveInteger(0, "port")).toThrow("entier positif");
    expect(() => validatePositiveInteger(-5, "port")).toThrow("entier positif");
  });
});

/** Équivalent jsdom-safe de path.join (le test tourne en node). */
function pathJoin(...parts: string[]): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path") as typeof import("path");
  return path.join(...parts);
}
