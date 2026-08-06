import { useState, useEffect, useCallback } from "react";
import { secureGet, secureSet, secureDelete } from "../lib/secureStorage";

/**
 * Hook de stockage sécurisé (keyring OS en Tauri, localStorage clair en web).
 * Chargement asynchrone : value est null tant que le secret n'est pas lu.
 */
export function useSecureStorage<T>(
  key: string,
  initialValue: T
): {
  value: T | null;
  loading: boolean;
  setValue: (value: T | ((val: T) => T)) => void;
  remove: () => void;
} {
  const [value, setValueState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await secureGet(key);
        if (cancelled) return;
        if (raw != null) {
          setValueState(JSON.parse(raw) as T);
        } else {
          setValueState(initialValue);
        }
      } catch (e) {
        console.warn(`[useSecureStorage] Erreur lecture "${key}" :`, e);
        if (!cancelled) setValueState(initialValue);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback(
    (next: T | ((val: T) => T)) => {
      setValueState((prev) => {
        const current = prev ?? initialValue;
        const valueToStore = next instanceof Function ? next(current) : next;
        const serialized = JSON.stringify(valueToStore);
        secureSet(key, serialized).catch((e) =>
          console.warn(`[useSecureStorage] Erreur écriture "${key}" :`, e)
        );
        return valueToStore;
      });
    },
    [key, initialValue]
  );

  const remove = useCallback(() => {
    secureDelete(key).catch((e) =>
      console.warn(`[useSecureStorage] Erreur suppression "${key}" :`, e)
    );
    setValueState(null);
  }, [key]);

  return { value, loading, setValue, remove };
}
