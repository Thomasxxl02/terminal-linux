import { describe, it, expect } from "vitest";
import {
  issueRefreshToken,
  consumeRefreshToken,
  revokeRefreshTokensForJti,
} from "../backend/auth";

// Tests unitaires des fonctions pures d'auth : rotation des refresh
// tokens (consommés après usage, jamais réutilisables), révocation par
// jti, gestion des sessions expirées.
describe("auth — rotation et révocation des refresh tokens", () => {
  it("émet un refresh token et le consomme une seule fois (rotation)", () => {
    const token = issueRefreshToken("admin", "jti-1");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(16);

    // 1er usage : rôle + jti restitués
    const first = consumeRefreshToken(token);
    expect(first).toEqual({ role: "admin", jti: "jti-1" });

    // 2e usage (rejeu) : null — l'ancien token est consommé
    expect(consumeRefreshToken(token)).toBeNull();
  });

  it("refuse un refresh token inconnu ou vide", () => {
    expect(consumeRefreshToken("token-inexistant")).toBeNull();
    expect(consumeRefreshToken("")).toBeNull();
    // Garde sur valeur non-string (strictNullChecks désactivé : undefined passe)
    expect(consumeRefreshToken(undefined as unknown as string)).toBeNull();
  });

  it("révoque tous les refresh tokens d'un jti (logout)", () => {
    const t1 = issueRefreshToken("admin", "jti-common");
    const t2 = issueRefreshToken("admin", "jti-common");
    const t3 = issueRefreshToken("user", "jti-autre");

    revokeRefreshTokensForJti("jti-common");

    expect(consumeRefreshToken(t1)).toBeNull();
    expect(consumeRefreshToken(t2)).toBeNull();
    // Le jti non révoqué reste valide
    expect(consumeRefreshToken(t3)).toEqual({ role: "user", jti: "jti-autre" });
  });
});
