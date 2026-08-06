import { useState, useEffect, useCallback } from "react";

// List of keys containing potentially sensitive user credentials, private key paths, or environments
const SENSITIVE_KEYS = [
  "terminal_ssh_hosts",
  "tauri_linux_shell_profiles",
  "tauri_linux_saved_tabs",
  "tauri_linux_terminal_command_history"
];

// Robust, reversible obfuscation to prevent cleartext storage of sensitive info in localStorage
export function encryptValue(text: string): string {
  try {
    const b64 = btoa(unescape(encodeURIComponent(text)));
    // Apply a simple XOR mask to obfuscate the base64 string
    return b64.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ 42)).join("");
  } catch (e) {
    return text;
  }
}

export function decryptValue(cipher: string): string {
  if (!cipher) return cipher;
  const trimmed = cipher.trim();
  // If it's already plain JSON (starts with { or [), return as-is for backwards compatibility
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return cipher;
  }
  try {
    const b64 = cipher.split("").map(c => String.fromCharCode(c.charCodeAt(0) ^ 42)).join("");
    return decodeURIComponent(escape(atob(b64)));
  } catch (e) {
    return cipher;
  }
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const isSensitive = SENSITIVE_KEYS.includes(key);

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const decrypted = isSensitive ? decryptValue(item) : item;
        return JSON.parse(decrypted) as T;
      }
      return initialValue;
    } catch (error) {
      console.warn(`[useLocalStorage] Erreur lors de la lecture de la clé "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        setStoredValue((prev) => {
          const valueToStore = value instanceof Function ? value(prev) : value;
          const serialized = JSON.stringify(valueToStore);
          const finalValue = isSensitive ? encryptValue(serialized) : serialized;
          window.localStorage.setItem(key, finalValue);
          return valueToStore;
        });
      } catch (error) {
        console.warn(`[useLocalStorage] Erreur lors de l'écriture de la clé "${key}":`, error);
      }
    },
    [key, isSensitive]
  );

  return [storedValue, setValue];
}


