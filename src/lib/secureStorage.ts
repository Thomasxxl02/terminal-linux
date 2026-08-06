/**
 * Stockage sécurisé des secrets.
 *
 * - Mode Tauri : le keyring OS (GNOME Keyring / macOS Keychain /
 *   Windows Credential Manager) via les commandes Rust secure_*.
 * - Mode web : fallback localStorage EN CLAIR — délibérément documenté
 *   comme non sécurisé (aucune fausse "obfuscation" XOR qui ne protège rien).
 */
import { isTauri, tauriInvoke } from "./tauri";

export async function secureGet(key: string): Promise<string | null> {
  if (isTauri()) {
    try {
      return await tauriInvoke<string | null>("secure_get", { key });
    } catch (e) {
      console.error(`[secureStorage] keyring lecture échouée pour "${key}" :`, e);
      return null;
    }
  }
  // Mode web : pas de keyring — localStorage en clair (documenté)
  return localStorage.getItem(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke("secure_set", { key, value });
      return;
    } catch (e) {
      console.error(`[secureStorage] keyring écriture échouée pour "${key}" :`, e);
    }
  }
  localStorage.setItem(key, value);
}

export async function secureDelete(key: string): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke("secure_delete", { key });
      return;
    } catch (e) {
      console.error(`[secureStorage] keyring suppression échouée pour "${key}" :`, e);
    }
  }
  localStorage.removeItem(key);
}
