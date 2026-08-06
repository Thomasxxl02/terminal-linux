import { describe, it, expect } from "vitest";
import { errMsg } from "../lib/errors";

describe("errMsg (extraction de message d'erreur)", () => {
  it("retourne le message d'une Error", () => {
    expect(errMsg(new Error("Échec réseau"))).toBe("Échec réseau");
  });

  it("retourne la chaîne telle quelle", () => {
    expect(errMsg("Erreur brute")).toBe("Erreur brute");
    expect(errMsg("")).toBe("");
  });

  it("sérialise un objet en JSON", () => {
    expect(errMsg({ code: 42, detail: "x" })).toBe('{"code":42,"detail":"x"}');
  });

  it("retourne une valeur par défaut pour les types non sérialisables", () => {
    // Objet circulaire → JSON.stringify lance → fallback
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(errMsg(circular)).toBe("Erreur inconnue");
  });

  it("gère les primitives simples", () => {
    expect(errMsg(42)).toBe("42");
    expect(errMsg(null)).toBe("null");
    expect(errMsg(undefined)).toBe(undefined);
  });
});
