/**
 * API système de fichiers unifiée (éditeur Monaco).
 *
 * - Mode Tauri : commandes Rust natives (fs_tree, fs_read, fs_write…)
 *   — mêmes règles de sécurité que le backend web (2 Mo max, 300 items).
 * - Mode web : routes Express /api/fs/* (avec JWT).
 *
 * Les formats sont normalisés côté appelant (camelCase, isDirectory).
 */
import { isTauri, tauriInvoke } from "./tauri";
import { apiFetch } from "./api";

export interface FsItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
}

export interface FsTree {
  currentPath: string;
  parentPath: string;
  items: FsItem[];
  totalCount: number;
  truncated: boolean;
}

interface RustFsItem {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
}

interface RawFsTree {
  items?: RustFsItem[];
  currentPath?: string;
  current_path?: string;
  parentPath?: string;
  parent_path?: string;
  totalCount?: number;
  total_count?: number;
  truncated?: boolean;
}

function normalizeTree(r: RawFsTree): FsTree {
  const items: FsItem[] = (r.items || []).map((i: RustFsItem) => ({
    name: i.name,
    path: i.path,
    isDirectory: i.is_directory,
    size: i.size ?? 0,
  }));
  return {
    currentPath: r.currentPath ?? r.current_path ?? "",
    parentPath: r.parentPath ?? r.parent_path ?? "",
    items,
    totalCount: r.totalCount ?? r.total_count ?? items.length,
    truncated: r.truncated ?? false,
  };
}

export async function fsTree(dirPath?: string): Promise<FsTree> {
  if (isTauri()) {
    const res = await tauriInvoke<any>("fs_tree", { dir: dirPath ?? "/" });
    return normalizeTree(res);
  }
  const url = dirPath ? `/api/fs/tree?path=${encodeURIComponent(dirPath)}` : "/api/fs/tree";
  const res = await apiFetch(url);
  return normalizeTree(await res.json());
}

export async function fsRead(filePath: string): Promise<{
  path: string;
  name: string;
  content: string;
  extension: string;
}> {
  if (isTauri()) {
    const r = await tauriInvoke<any>("fs_read", { path: filePath });
    return {
      path: r.path,
      name: r.name,
      content: r.content,
      extension: r.extension ?? "",
    };
  }
  const res = await apiFetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fsWrite(path: string, content: string, encoding?: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("fs_write", { path, content, encoding: encoding ?? null });
    return;
  }
  const res = await apiFetch("/api/fs/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content, encoding }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}

export async function fsCreateFile(path: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("fs_create_file", { path });
    return;
  }
  const res = await apiFetch("/api/fs/create-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}

export async function fsCreateDirectory(path: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("fs_create_directory", { path });
    return;
  }
  const res = await apiFetch("/api/fs/create-directory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}

export async function fsDelete(path: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("fs_delete", { path });
    return;
  }
  const res = await apiFetch("/api/fs/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}

export async function fsRename(oldPath: string, newPath: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke("fs_rename", { oldPath, newPath });
    return;
  }
  const res = await apiFetch("/api/fs/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldPath, newPath }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}
