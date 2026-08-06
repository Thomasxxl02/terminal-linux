import { useState, useEffect, useCallback } from "react";

/**
 * Stockage localStorage simple, SANS fausse "obfuscation".
 *
 * Note de sécurité honnête : le localStorage n'est PAS un stockage sécurisé.
 * Pour les données sensibles (hôtes SSH, clés privées, profils), utiliser
 * useSecureStorage (keyring OS en Tauri). Ne rien stocker de réellement
 * confidentiel via ce hook.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
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
          window.localStorage.setItem(key, serialized);
          return valueToStore;
        });
      } catch (error) {
        console.warn(`[useLocalStorage] Erreur lors de l'écriture de la clé "${key}":`, error);
      }
    },
    [key]
  );

  return [storedValue, setValue];
}
