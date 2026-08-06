/** Extrait un message d'erreur lisible depuis une valeur inconnue. */
export function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Erreur inconnue";
  }
}
