// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import { app } from "../../server";

const TEST_DIR = path.join(process.cwd(), ".api-test-tmp");

describe("Routes FS — cycle de vie complet (tree → read → write → rename → delete)", () => {
  beforeAll(() => {
    if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("GET /api/fs/tree liste le dossier avec isDirectory camelCase", async () => {
    const res = await request(app).get("/api/fs/tree").query({ path: TEST_DIR });
    expect(res.status).toBe(200);
    expect(res.body.currentPath).toBe(TEST_DIR);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("GET /api/fs/tree retourne 404 sur un dossier inexistant (dans le workspace)", async () => {
    const res = await request(app).get("/api/fs/tree").query({ path: "dossier-inexistant-xyz" });
    expect(res.status).toBe(404);
  });

  it("GET /api/fs/tree bloque le path traversal (../..)", async () => {
    const res = await request(app).get("/api/fs/tree").query({ path: "../../../etc" });
    expect(res.status).toBe(500);
  });

  it("POST /api/fs/write crée un fichier avec du contenu", async () => {
    const file = path.join(TEST_DIR, "test.txt");
    const res = await request(app)
      .post("/api/fs/write")
      .send({ path: file, content: "contenu de test" });
    expect(res.status).toBe(200);
    expect(fs.readFileSync(file, "utf-8")).toBe("contenu de test");
  });

  it("POST /api/fs/write accepte l'encodage base64", async () => {
    const file = path.join(TEST_DIR, "b64.txt");
    const res = await request(app)
      .post("/api/fs/write")
      .send({ path: file, content: Buffer.from("données b64").toString("base64"), encoding: "base64" });
    expect(res.status).toBe(200);
    expect(fs.readFileSync(file, "utf-8")).toBe("données b64");
  });

  it("POST /api/fs/write rejette un contenu non-chaîne", async () => {
    const res = await request(app)
      .post("/api/fs/write")
      .send({ path: path.join(TEST_DIR, "x.txt"), content: 12345 });
    expect(res.status).toBe(500);
  });

  it("GET /api/fs/read lit un fichier existant", async () => {
    const file = path.join(TEST_DIR, "test.txt");
    const res = await request(app).get("/api/fs/read").query({ path: file });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe("contenu de test");
    expect(res.body.extension).toBe("txt");
  });

  it("GET /api/fs/read retourne 404 sur un fichier inexistant", async () => {
    const res = await request(app).get("/api/fs/read").query({ path: path.join(TEST_DIR, "nope.txt") });
    expect(res.status).toBe(404);
  });

  it("POST /api/fs/create-file crée un fichier vide", async () => {
    const file = path.join(TEST_DIR, "nouveau.txt");
    const res = await request(app).post("/api/fs/create-file").send({ path: file });
    expect(res.status).toBe(200);
    expect(fs.existsSync(file)).toBe(true);
  });

  it("POST /api/fs/create-file refuse un fichier existant", async () => {
    const file = path.join(TEST_DIR, "test.txt");
    const res = await request(app).post("/api/fs/create-file").send({ path: file });
    expect(res.status).toBe(400);
  });

  it("POST /api/fs/create-directory crée un dossier", async () => {
    const dir = path.join(TEST_DIR, "sous-dossier");
    const res = await request(app).post("/api/fs/create-directory").send({ path: dir });
    expect(res.status).toBe(200);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("POST /api/fs/rename renomme un fichier", async () => {
    const oldPath = path.join(TEST_DIR, "test.txt");
    const newPath = path.join(TEST_DIR, "renommé.txt");
    const res = await request(app)
      .post("/api/fs/rename")
      .send({ oldPath, newPath });
    expect(res.status).toBe(200);
    expect(fs.existsSync(newPath)).toBe(true);
    expect(fs.existsSync(oldPath)).toBe(false);
  });

  it("POST /api/fs/rename retourne 404 si la source n'existe pas", async () => {
    const res = await request(app)
      .post("/api/fs/rename")
      .send({ oldPath: path.join(TEST_DIR, "absent.txt"), newPath: path.join(TEST_DIR, "x.txt") });
    expect(res.status).toBe(404);
  });

  it("POST /api/fs/delete supprime un fichier", async () => {
    const file = path.join(TEST_DIR, "renommé.txt");
    const res = await request(app).post("/api/fs/delete").send({ path: file });
    expect(res.status).toBe(200);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("POST /api/fs/delete retourne 404 sur un élément inexistant", async () => {
    const res = await request(app).post("/api/fs/delete").send({ path: path.join(TEST_DIR, "rien.txt") });
    expect(res.status).toBe(404);
  });
});

describe("Routes réseau / shells / source", () => {
  it("GET /api/network/port-check valide un port réellement libre", async () => {
    const res = await request(app).get("/api/network/port-check").query({ port: 39999 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("available");
    expect(typeof res.body.available).toBe("boolean");
  });

  it("GET /api/network/port-check rejette un port invalide", async () => {
    const res = await request(app).get("/api/network/port-check").query({ port: "abc" });
    expect(res.status).toBe(400);
  });

  it("GET /api/shells/check audite les shells réels du système", async () => {
    const res = await request(app).get("/api/shells/check");
    expect(res.status).toBe(200);
    expect(res.body.shells.length).toBeGreaterThan(0);
    // bash est présent sur le système de test
    const bash = res.body.shells.find((s: { name: string }) => s.name === "bash");
    expect(bash.present).toBe(true);
  });

  it("GET /api/tauri/source?group=rust lit les vrais fichiers Rust", async () => {
    const res = await request(app).get("/api/tauri/source").query({ group: "rust" });
    expect(res.status).toBe(200);
    expect(res.body.mainRs.length).toBeGreaterThan(0);
    expect(res.body.cargoToml.length).toBeGreaterThan(0);
  });

  it("GET /api/tauri/source?group=backend lit server.ts et routes.ts", async () => {
    const res = await request(app).get("/api/tauri/source").query({ group: "backend" });
    expect(res.status).toBe(200);
    expect(res.body.serverTs.length).toBeGreaterThan(0);
    expect(res.body.routesTs.length).toBeGreaterThan(0);
  });

  it("GET /api/tauri/source?group=frontend lit App.tsx", async () => {
    const res = await request(app).get("/api/tauri/source").query({ group: "frontend" });
    expect(res.status).toBe(200);
    expect(res.body.appTsx.length).toBeGreaterThan(0);
  });

  it("GET /api/tauri/source?group=config lit package.json", async () => {
    const res = await request(app).get("/api/tauri/source").query({ group: "config" });
    expect(res.status).toBe(200);
    expect(res.body.packageJson.length).toBeGreaterThan(0);
  });

  it("GET /api/tauri/source?group=python lit les scripts réels", async () => {
    const res = await request(app).get("/api/tauri/source").query({ group: "python" });
    expect(res.status).toBe(200);
    expect(res.body.systemHealthPy.length).toBeGreaterThan(0);
  });

  it("GET /api/tauri/source?group=inconnu retourne 400", async () => {
    const res = await request(app).get("/api/tauri/source").query({ group: "xyz" });
    expect(res.status).toBe(400);
  });
});

describe("Routes PTY — erreurs et cycle", () => {
  it("POST /api/pty/create sans nom crée une session (nom optionnel)", async () => {
    const res = await request(app).post("/api/pty/create").send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    // Nettoyage
    await request(app).delete(`/api/pty/${res.body.id}`);
  });

  it("POST /api/pty/:id/write sur une session inexistante retourne une erreur", async () => {
    const res = await request(app)
      .post("/api/pty/inexistante/write")
      .send({ data: "echo test" });
    expect([400, 404, 500]).toContain(res.status);
  });

  it("DELETE /api/pty/:id sur une session inexistante retourne une erreur", async () => {
    const res = await request(app).delete("/api/pty/inexistante");
    expect([400, 404, 500]).toContain(res.status);
  });
});
