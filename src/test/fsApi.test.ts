import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks : tauri (isTauri) + api (apiFetch) ──
const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(),
  tauriInvoke: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock("../lib/tauri", () => ({
  isTauri: mocks.isTauri,
  tauriInvoke: mocks.tauriInvoke,
}));
vi.mock("../lib/api", () => ({ apiFetch: mocks.apiFetch }));

import {
  fsTree,
  fsRead,
  fsWrite,
  fsCreateFile,
  fsCreateDirectory,
  fsDelete,
  fsRename,
} from "../lib/fsApi";

function mockRes(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

describe("fsApi — mode web (routes Express /api/fs/*)", () => {
  beforeEach(() => {
    mocks.isTauri.mockReturnValue(false);
    mocks.apiFetch.mockReset();
    mocks.tauriInvoke.mockReset();
  });

  it("fsTree normalise le format web (camelCase) et encode le chemin", async () => {
    mocks.apiFetch.mockResolvedValue(
      mockRes({
        currentPath: "/projet",
        parentPath: "/",
        items: [
          { name: "src", path: "/projet/src", isDirectory: true, size: 0 },
          { name: "main.rs", path: "/projet/main.rs", isDirectory: false, size: 1024 },
        ],
        totalCount: 2,
        truncated: false,
      })
    );

    const tree = await fsTree("/projet");
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/fs/tree?path=%2Fprojet");
    expect(tree.items).toHaveLength(2);
    expect(tree.items[0]).toEqual({ name: "src", path: "/projet/src", isDirectory: true, size: 0 });
    expect(tree.currentPath).toBe("/projet");
  });

  it("fsTree sans chemin appelle /api/fs/tree", async () => {
    mocks.apiFetch.mockResolvedValue(mockRes({ items: [] }));
    await fsTree();
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/fs/tree");
  });

  it("fsRead lève une erreur si le serveur renvoie une erreur", async () => {
    mocks.apiFetch.mockResolvedValue(mockRes({ error: "Fichier introuvable" }));
    await expect(fsRead("/nope.txt")).rejects.toThrow("Fichier introuvable");
  });

  it("fsRead retourne le contenu en cas de succès", async () => {
    mocks.apiFetch.mockResolvedValue(
      mockRes({ path: "/a.txt", name: "a.txt", content: "hello", extension: "txt" })
    );
    const file = await fsRead("/a.txt");
    expect(file.content).toBe("hello");
    expect(file.extension).toBe("txt");
  });

  it("fsWrite POST le contenu (encodage inclus)", async () => {
    mocks.apiFetch.mockResolvedValue(mockRes({ ok: true }));
    await fsWrite("/a.txt", "data", "base64");
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/fs/write",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path: "/a.txt", content: "data", encoding: "base64" }),
      })
    );
  });

  it("fsWrite lève une erreur sur réponse d'erreur", async () => {
    mocks.apiFetch.mockResolvedValue(mockRes({ error: "Trop gros" }));
    await expect(fsWrite("/a.txt", "x")).rejects.toThrow("Trop gros");
  });

  it("fsCreateFile / fsCreateDirectory / fsDelete / fsRename POSTent vers les bonnes routes", async () => {
    mocks.apiFetch.mockResolvedValue(mockRes({ ok: true }));

    await fsCreateFile("/f.txt");
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/fs/create-file",
      expect.objectContaining({ body: JSON.stringify({ path: "/f.txt" }) })
    );

    await fsCreateDirectory("/d");
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/fs/create-directory",
      expect.objectContaining({ body: JSON.stringify({ path: "/d" }) })
    );

    await fsDelete("/f.txt");
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/fs/delete",
      expect.objectContaining({ body: JSON.stringify({ path: "/f.txt" }) })
    );

    await fsRename("/old", "/new");
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/fs/rename",
      expect.objectContaining({ body: JSON.stringify({ oldPath: "/old", newPath: "/new" }) })
    );
  });
});

describe("fsApi — mode Tauri (commandes Rust)", () => {
  beforeEach(() => {
    mocks.isTauri.mockReturnValue(true);
    mocks.apiFetch.mockReset();
    mocks.tauriInvoke.mockReset();
  });

  it("fsTree normalise le format snake_case Rust (is_directory → isDirectory)", async () => {
    mocks.tauriInvoke.mockResolvedValue({
      current_path: "/projet",
      parent_path: "/",
      items: [{ name: "main.rs", path: "/projet/main.rs", is_directory: false, size: 42 }],
      total_count: 1,
      truncated: false,
    });
    const tree = await fsTree("/projet");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("fs_tree", { dir: "/projet" });
    expect(tree.items[0].isDirectory).toBe(false);
    expect(tree.items[0].size).toBe(42);
    expect(tree.totalCount).toBe(1);
  });

  it("fsRead délègue à fs_read", async () => {
    mocks.tauriInvoke.mockResolvedValue({ path: "/a.rs", name: "a.rs", content: "fn main(){}", extension: "rs" });
    const file = await fsRead("/a.rs");
    expect(file.extension).toBe("rs");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("fs_read", { path: "/a.rs" });
  });

  it("fsWrite / fsCreateFile / fsCreateDirectory / fsDelete / fsRename délèguent en Rust", async () => {
    mocks.tauriInvoke.mockResolvedValue(undefined);

    await fsWrite("/a", "c", "base64");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("fs_write", { path: "/a", content: "c", encoding: "base64" });

    await fsCreateFile("/f");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("fs_create_file", { path: "/f" });

    await fsCreateDirectory("/d");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("fs_create_directory", { path: "/d" });

    await fsDelete("/f");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("fs_delete", { path: "/f" });

    await fsRename("/o", "/n");
    expect(mocks.tauriInvoke).toHaveBeenCalledWith("fs_rename", { oldPath: "/o", newPath: "/n" });
  });

  it("ne fait jamais appel à apiFetch en mode Tauri", async () => {
    mocks.tauriInvoke.mockResolvedValue({ items: [] });
    await fsTree("/");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
