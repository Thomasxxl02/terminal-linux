// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../server";

// Ces tests vérifient le cycle de vie du JWT avec AUTH_SECRET activé.
// Note : server.ts ne démarre pas le listener en mode test (NODE_ENV=test).

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-key-32-chars-minimum!!";
  process.env.ADMIN_TOKEN = "static-admin-token";
  process.env.DEV_TOKEN = "static-dev-token";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Auth API", () => {
  it("login accepte un token statique admin et renvoie un JWT", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ token: "static-admin-token" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe("admin");
    expect(res.body.authEnabled).toBe(true);
  });

  it("login refuse un token inconnu", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ token: "wrong-token" });

    expect(res.status).toBe(401);
  });

  it("login exige un token", async () => {
    const res = await request(app).post("/api/auth/login").send({});

    expect(res.status).toBe(400);
  });

  it("les routes protégées refusent sans JWT (401)", async () => {
    const res = await request(app).get("/api/pty/sessions");

    expect(res.status).toBe(401);
  });

  it("les routes protégées refusent un JWT invalide (401)", async () => {
    const res = await request(app)
      .get("/api/pty/sessions")
      .set("Authorization", "Bearer invalid.token.here");

    expect(res.status).toBe(401);
  });

  it("les routes protégées acceptent un JWT valide", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ token: "static-admin-token" });
    const jwt = loginRes.body.token;

    const res = await request(app)
      .get("/api/pty/sessions")
      .set("Authorization", `Bearer ${jwt}`);

    expect(res.status).toBe(200);
    expect(res.body.sessions).toBeDefined();
  });

  it("le rôle ne peut plus être forgé via header x-user-role", async () => {
    // Même avec x-user-role: admin, sans JWT → 401
    const res = await request(app)
      .get("/api/pty/sessions")
      .set("x-user-role", "admin");

    expect(res.status).toBe(401);
  });

  it("health reste public sans JWT", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });

  it("logout révoque le JWT (token rejeté ensuite)", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ token: "static-admin-token" });
    const jwt = loginRes.body.token;

    // Le token fonctionne avant logout
    const before = await request(app)
      .get("/api/pty/sessions")
      .set("Authorization", `Bearer ${jwt}`);
    expect(before.status).toBe(200);

    // Logout → révocation
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${jwt}`);
    expect(logoutRes.status).toBe(200);

    // Le même token est maintenant rejeté (blacklist jti)
    const after = await request(app)
      .get("/api/pty/sessions")
      .set("Authorization", `Bearer ${jwt}`);
    expect(after.status).toBe(401);
  });

  it("logout sans token ne lève pas d'erreur", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Auth — refresh token (rotation)", () => {
  it("login renvoie un refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ token: "static-admin-token" });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken.length).toBeGreaterThan(32);
  });

  it("refresh échange un refresh token contre un nouveau JWT + refresh", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ token: "static-admin-token" });
    const oldRefresh = loginRes.body.refreshToken;

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: oldRefresh });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(oldRefresh); // rotation
    expect(refreshRes.body.role).toBe("admin");
  });

  it("un refresh token consommé ne peut pas être réutilisé (rotation)", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ token: "static-admin-token" });
    const refreshToken = loginRes.body.refreshToken;

    // 1er usage : OK
    const first = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(first.status).toBe(200);

    // 2e usage du MÊME refresh : rejeté (rotation)
    const second = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(second.status).toBe(401);
  });

  it("refresh refuse un refresh token invalide", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "token-invalide-xyz" });
    expect(res.status).toBe(401);
  });

  it("refresh refuse un refresh token absent", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    expect(res.status).toBe(401);
  });

  it("le nouveau JWT émis par refresh fonctionne sur les routes protégées", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ token: "static-admin-token" });

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: loginRes.body.refreshToken });
    const newJwt = refreshRes.body.token;

    const res = await request(app)
      .get("/api/pty/sessions")
      .set("Authorization", `Bearer ${newJwt}`);
    expect(res.status).toBe(200);
  });

  it("logout révoque aussi le refresh token du jti", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ token: "static-admin-token" });
    const jwt = loginRes.body.token;
    const refreshToken = loginRes.body.refreshToken;

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${jwt}`);

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
