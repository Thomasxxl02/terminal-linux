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
});
